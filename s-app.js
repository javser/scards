(function() {
    'use strict';

    // ==================== КОНФИГ ОБОЛОЧКИ ====================
    const CONFIG = {
        SHELL_VERSION: '2.2.8',
        GAME_VERSION_DEFAULT: '1.0.0',
        REPO_PATH: '/scards/',
        DEBUG_MODE: true,
        DEBUG_MAX_LINES: 4
    };
    // =========================================================

    let isPWA = false;
    let swRegistration = null;
    let remoteVersions = { shell: null, game: null };

    // ==================== DEBUG-ПАНЕЛЬ ====================
    const Debug = {
        enabled: CONFIG.DEBUG_MODE,
        maxLines: CONFIG.DEBUG_MAX_LINES,
        panel: null,
        content: null,
        logs: [],

        init() {
            if (!this.enabled) return;

            this.panel = document.getElementById('debug-panel');
            this.content = document.getElementById('debug-panel')?.querySelector('.debug-panel-content');
            
            if (!this.panel || !this.content) {
                console.warn('Debug panel elements not found');
                return;
            }

            // Перехват console.log
            const originalLog = console.log;
            const originalError = console.error;
            const originalWarn = console.warn;

            const self = this;

            console.log = function(...args) {
                originalLog.apply(console, args);
                self.log('LOG', args.join(' '));
            };

            console.error = function(...args) {
                originalError.apply(console, args);                self.log('ERR', args.join(' '), 'error');
            };

            console.warn = function(...args) {
                originalWarn.apply(console, args);
                self.log('WRN', args.join(' '), 'warn');
            };

            this.log('Debug initialized');
        },

        log(type, message, level = 'log') {
            if (!this.enabled || !this.content) return;

            const time = new Date().toLocaleTimeString();
            const line = `[${time}] ${type}: ${message}`;
            
            this.logs.push(line);
            if (this.logs.length > this.maxLines) {
                this.logs.shift();
            }

            this.content.innerHTML = this.logs.map(l => {
                const cls = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
                return `<div class="debug-line debug-line--${cls}">${this.escapeHtml(l)}</div>`;
            }).join('');

            this.panel.scrollTop = this.panel.scrollHeight;
        },

        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    };
    // ======================================================

    // --- PWA Детекция ---
    function checkPWA() {
        isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                window.navigator.standalone === true;
        
        Debug.log('PWA: ' + isPWA);

        const exitButtons = document.querySelectorAll('.btn--exit');
        const updateButton = document.querySelector('.btn--update');
        
        if (!isPWA) {
            exitButtons.forEach(btn => btn.style.display = 'none');            updateButton.style.display = 'none';
        }
    }

    // --- Отображение версий ---
    function updateVersionDisplay(shellVer, gameVer) {
        const shellEl = document.getElementById('shell-version');
        const gameEl = document.getElementById('game-version');
        
        Debug.log('Update versions: shell=' + shellVer + ', game=' + gameVer);

        if (shellEl) {
            shellEl.textContent = 'v' + shellVer;
        } else {
            Debug.log('ERROR: shell-version element not found', 'error');
        }

        if (gameEl) {
            gameEl.textContent = 'v' + gameVer;
        } else {
            Debug.log('ERROR: game-version element not found', 'error');
        }
    }

    // --- Сравнение версий ---
    function compareVersions(v1, v2) {
        return v1.localeCompare(v2, undefined, { numeric: true });
    }

    // --- Проверка обновлений ---
    async function checkForUpdates() {
        Debug.log('Check updates...');

        if (!isPWA) {
            Debug.log('Not PWA');
            return;
        }

        if (!navigator.onLine) {
            Debug.log('Offline');
            return;
        }

        try {
            const shellRes = await fetch(CONFIG.REPO_PATH + 's-version.json?t=' + Date.now());
            const gameRes = await fetch(CONFIG.REPO_PATH + 'g-version.json?t=' + Date.now());
            
            if (!shellRes.ok || !gameRes.ok) {
                Debug.log('Network error');
                return;            }

            const shellData = await shellRes.json();
            const gameData = await gameRes.json();

            remoteVersions.shell = shellData.version;
            remoteVersions.game = gameData.version;

            const storedShell = localStorage.getItem('shell_version') || CONFIG.SHELL_VERSION;
            const storedGame = localStorage.getItem('game_version') || CONFIG.GAME_VERSION_DEFAULT;

            const shellUpdate = compareVersions(remoteVersions.shell, storedShell) > 0;
            const gameUpdate = compareVersions(remoteVersions.game, storedGame) > 0;

            Debug.log('Stored: ' + storedShell + '/' + storedGame);
            Debug.log('Remote: ' + remoteVersions.shell + '/' + remoteVersions.game);

            // Показываем ТЕКУЩИЕ (stored) версии
            updateVersionDisplay(storedShell, storedGame);

            if (shellUpdate || gameUpdate) {
                document.querySelector('.btn--update').classList.add('visible');
                Debug.log('Update available!');
            } else {
                document.querySelector('.btn--update').classList.remove('visible');
                Debug.log('No update');
            }

        } catch (e) {
            Debug.log('Check failed: ' + e.message);
        }
    }

    // --- Обновление ---
    async function performUpdate() {
        Debug.log('Update started');

        const modal = document.getElementById('update-modal');
        const progressBar = document.getElementById('update-progress');
        const progressText = document.getElementById('update-progress-text');
        const actions = document.getElementById('update-actions');

        if (!modal || !progressBar || !progressText || !actions) {
            Debug.log('Modal elements not found', 'error');
            return;
        }

        modal.classList.add('modal--visible');
        progressBar.classList.add('visible');
        actions.style.display = 'none';
        const filesToCache = [
            CONFIG.REPO_PATH + 's-index.html',
            CONFIG.REPO_PATH + 's-styles.css',
            CONFIG.REPO_PATH + 's-app.js',
            CONFIG.REPO_PATH + 'g-game.js',
            CONFIG.REPO_PATH + 'g-styles.css',
            CONFIG.REPO_PATH + 'g-config.js',
            CONFIG.REPO_PATH + 's-version.json',
            CONFIG.REPO_PATH + 'g-version.json',
            CONFIG.REPO_PATH + 's-manifest.json',
            CONFIG.REPO_PATH + 's-sw.js'
        ];

        const startTime = Date.now();
        const minDuration = 1000;

        for (let i = 0; i < filesToCache.length; i++) {
            try {
                await fetch(filesToCache[i] + '?t=' + Date.now(), { cache: 'reload' });
                
                const percent = Math.round(((i + 1) / filesToCache.length) * 100);
                progressText.textContent = percent + '%';
                progressBar.querySelector('.progress-bar').style.width = percent + '%';
                
                Debug.log('Downloaded ' + (i + 1) + '/' + filesToCache.length);
            } catch (e) {
                Debug.log('Failed: ' + filesToCache[i]);
            }
        }

        const elapsed = Date.now() - startTime;
        if (elapsed < minDuration) {
            await new Promise(resolve => setTimeout(resolve, minDuration - elapsed));
        }

        if (swRegistration && swRegistration.waiting) {
            swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
            Debug.log('SW activated');
        }

        if (remoteVersions.shell) {
            localStorage.setItem('shell_version', remoteVersions.shell);
        }
        if (remoteVersions.game) {
            localStorage.setItem('game_version', remoteVersions.game);
        }

        Debug.log('Restarting...');
        setTimeout(() => location.reload(), 500);    }

    function declineUpdate() {
        document.getElementById('update-modal').classList.remove('modal--visible');
        Debug.log('Update declined');
    }

    //

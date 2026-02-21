(function() {
    'use strict';

    // ==================== КОНФИГ ОБОЛОЧКИ ====================
    const CONFIG = {
        SHELL_VERSION: '2.2.7',
        GAME_VERSION_DEFAULT: '1.0.0',
        REPO_PATH: '/scards/',
        DEBUG_MODE: true,  // ← Включить/выключить debug-панель
        DEBUG_MAX_LINES: 5  // ← Количество строк в debug-панели
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

            this.panel = document.createElement('div');
            this.panel.id = 'debug-panel';
            this.panel.className = 'debug-panel';
            
            this.content = document.createElement('div');
            this.content.className = 'debug-panel-content';
            
            this.panel.appendChild(this.content);
            document.body.appendChild(this.panel);

            // Перехват console.log
            const originalLog = console.log;
            const originalError = console.error;
            const originalWarn = console.warn;

            console.log = (...args) => {
                originalLog.apply(console, args);
                this.log('LOG', args.join(' '));
            };

            console.error = (...args) => {
                originalError.apply(console, args);                this.log('ERR', args.join(' '), 'error');
            };

            console.warn = (...args) => {
                originalWarn.apply(console, args);
                this.log('WRN', args.join(' '), 'warn');
            };

            this.log('Debug panel initialized');
        },

        log(type, message, level = 'log') {
            if (!this.enabled || !this.content) return;

            const time = new Date().toLocaleTimeString();
            const line = `[${time}] ${type}: ${message}`;
            
            this.logs.push(line);
            if (this.logs.length > this.maxLines) {
                this.logs.shift();
            }

            this.content.innerHTML = this.logs.map(l => 
                `<div class="debug-line debug-line--${level}">${this.escapeHtml(l)}</div>`
            ).join('');

            // Авто-скролл вниз
            this.panel.scrollTop = this.panel.scrollHeight;
        },

        clear() {
            this.logs = [];
            if (this.content) this.content.innerHTML = '';
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
        
        const exitButtons = document.querySelectorAll('.btn--exit');
        const updateButton = document.querySelector('.btn--update');        
        if (!isPWA) {
            exitButtons.forEach(btn => btn.style.display = 'none');
            updateButton.style.display = 'none';
        }

        Debug.log('PWA mode: ' + isPWA);
    }

    // --- Отображение версий ---
    function updateVersionDisplay(shellVer, gameVer) {
        const shellEl = document.getElementById('shell-version');
        const gameEl = document.getElementById('game-version');
        
        if (shellEl) shellEl.textContent = 'v' + shellVer;
        if (gameEl) gameEl.textContent = 'v' + gameVer;

        Debug.log('Versions displayed: shell=' + shellVer + ', game=' + gameVer);
    }

    // --- Сравнение версий ---
    function compareVersions(v1, v2) {
        return v1.localeCompare(v2, undefined, { numeric: true });
    }

    // --- ШАГ 1: Запрос версий при старте ---
    async function checkForUpdates() {
        Debug.log('Checking for updates...');

        if (!isPWA) {
            Debug.log('Not PWA, skipping');
            return;
        }

        if (!navigator.onLine) {
            Debug.log('Offline, skipping');
            return;
        }

        try {
            const shellRes = await fetch(CONFIG.REPO_PATH + 's-version.json?t=' + Date.now());
            const gameRes = await fetch(CONFIG.REPO_PATH + 'g-version.json?t=' + Date.now());
            
            if (!shellRes.ok || !gameRes.ok) {
                Debug.log('Network error fetching versions');
                return;
            }

            const shellData = await shellRes.json();
            const gameData = await gameRes.json();
            remoteVersions.shell = shellData.version;
            remoteVersions.game = gameData.version;

            const storedShell = localStorage.getItem('shell_version') || CONFIG.SHELL_VERSION;
            const storedGame = localStorage.getItem('game_version') || CONFIG.GAME_VERSION_DEFAULT;

            const shellUpdate = compareVersions(remoteVersions.shell, storedShell) > 0;
            const gameUpdate = compareVersions(remoteVersions.game, storedGame) > 0;

            Debug.log('Versions: stored={' + storedShell + '/' + storedGame + '} remote={' + remoteVersions.shell + '/' + remoteVersions.game + '}');

            // ⚠️ ВАЖНО: Показываем ТЕКУЩИЕ (stored) версии до обновления
            updateVersionDisplay(storedShell, storedGame);

            if (shellUpdate || gameUpdate) {
                document.querySelector('.btn--update').classList.add('visible');
                Debug.log('Update available! Button shown');
            } else {
                document.querySelector('.btn--update').classList.remove('visible');
                Debug.log('No update available');
            }

        } catch (e) {
            Debug.log('Check failed: ' + e.message);
        }
    }

    // --- ШАГ 2: Скачивание файлов с прогрессом ---
    async function performUpdate() {
        Debug.log('Update started...');

        const modal = document.getElementById('update-modal');
        const progressBar = document.getElementById('update-progress');
        const progressText = document.getElementById('update-progress-text');
        const actions = document.getElementById('update-actions');

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
            CONFIG.REPO_PATH + 'g-version.json',            CONFIG.REPO_PATH + 's-manifest.json',
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

        // ⚠️ ВАЖНО: Обновляем версии в localStorage только после скачивания
        if (remoteVersions.shell) {
            localStorage.setItem('shell_version', remoteVersions.shell);
        }
        if (remoteVersions.game) {
            localStorage.setItem('game_version', remoteVersions.game);
        }

        Debug.log('Update complete, restarting...');

        setTimeout(() => location.reload(), 500);
    }

    function declineUpdate() {
        document.getElementById('update-modal').classList.remove('modal--visible');
        Debug.log('Update declined');
    }

    // --- Навигация ---    function showShell() {
        document.getElementById('game-screen').classList.remove('screen--active');
        document.getElementById('shell-screen').classList.add('screen--active');
        document.getElementById('close-screen').classList.remove('visible');
        Debug.log('Show shell');
    }

    function showGame() {
        document.getElementById('shell-screen').classList.remove('screen--active');
        document.getElementById('game-screen').classList.add('screen--active');
        Debug.log('Show game');
    }

    function startGame() {
        if (window.Game && typeof window.Game.start === 'function') {
            window.Game.start();
            history.pushState({ screen: 'game' }, '', CONFIG.REPO_PATH + '?game=cards');
            showGame();
        } else {
            Debug.log('Game API not available');
        }
    }

    function exitGame() {
        history.back();
        Debug.log('Exit game');
    }

    function handleExit() {
        if (isPWA) {
            if (window.close) window.close();
            document.getElementById('close-screen').classList.add('visible');
            Debug.log('Exit PWA');
        } else {
            showShell();
        }
    }

    window.addEventListener('popstate', (e) => {
        Debug.log('Popstate: ' + JSON.stringify(e.state));
        if (e.state?.screen === 'game') showGame();
        else showShell();
    });

    // --- Service Worker ---
    function registerSW() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register(CONFIG.REPO_PATH + 's-sw.js', { scope: CONFIG.REPO_PATH })
                .then(reg => {
                    swRegistration = reg;                    Debug.log('SW registered');
                })
                .catch(err => Debug.log('SW error: ' + err.message));
        }
    }

    // --- Обработчики ---
    function initEventListeners() {
        document.getElementById('shell-screen').addEventListener('click', e => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            Debug.log('Button: ' + btn.dataset.action);

            switch (btn.dataset.action) {
                case 'play': startGame(); break;
                case 'update': performUpdate(); break;
                case 'exit': handleExit(); break;
            }
        });

        document.getElementById('game-screen').addEventListener('click', e => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            switch (btn.dataset.action) {
                case 'restart':
                    if (window.Game) window.Game.start();
                    break;
                case 'exit': exitGame(); break;
            }
        });

        document.getElementById('update-modal').addEventListener('click', e => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            if (btn.dataset.action === 'confirm-update') performUpdate();
            else if (btn.dataset.action === 'decline-update') declineUpdate();
        });
    }

    // --- Инициализация ---
    async function init() {
        Debug.init();  // ← Инициализация debug-панели
        Debug.log('App starting v' + CONFIG.SHELL_VERSION);
        
        checkPWA();
        
        // Показываем ТЕКУЩИЕ (stored) версии сразу        const storedShell = localStorage.getItem('shell_version') || CONFIG.SHELL_VERSION;
        const storedGame = localStorage.getItem('game_version') || CONFIG.GAME_VERSION_DEFAULT;
        updateVersionDisplay(storedShell, storedGame);
        
        registerSW();
        
        // Запрос версий → показать кнопку если есть обновление
        await checkForUpdates();
        
        initEventListeners();

        const params = new URLSearchParams(window.location.search);
        if (params.get('game') === 'cards' && window.Game) {
            window.Game.start();
            showGame();
        }
    }

    window.Shell = {
        versions: { shell: CONFIG.SHELL_VERSION, game: CONFIG.GAME_VERSION_DEFAULT },
        navigateToShell: showShell,
        debug: Debug  // ← Доступ к debug из консоли
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

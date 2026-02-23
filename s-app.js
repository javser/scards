(function() {
    'use strict';

    const CONFIG = {
        SHELL_VERSION: '2.3.12',
        GAME_VERSION_DEFAULT: '1.0.2',
        REPO_PATH: '/scards/',
        DEBUG_MAX_LINES: 8
    };

    let isPWA = false;
    let debugEnabled = true;
    let swRegistration = null;
    let remoteVersions = { shell: null, game: null };
    let tapCount = 0;
    let tapTimer = null;

    const Debug = {
        panel: null,
        content: null,
        logs: [],

        init() {
            this.panel = document.getElementById('debug-panel');
            this.content = this.panel?.querySelector('.debug-panel-content');
            
            if (!this.panel || !this.content) {
                console.warn('Debug panel elements not found');
                return;
            }

            const saved = localStorage.getItem('debug_enabled');
            if (saved !== null) {
                debugEnabled = saved === 'true';
            }

            this.updateVisibility();
            this.log('=== SHELL v' + CONFIG.SHELL_VERSION + ' ===');
        },

        updateVisibility() {
            if (!this.panel) return;
            if (debugEnabled) {
                document.body.classList.add('debug-active');
            } else {
                document.body.classList.remove('debug-active');
            }
        },

        toggle() {            debugEnabled = !debugEnabled;
            localStorage.setItem('debug_enabled', debugEnabled);
            this.updateVisibility();
            this.log('Debug: ' + (debugEnabled ? 'ON' : 'OFF'));
        },

        log(message, level = 'log') {
            if (!debugEnabled || !this.content) return;

            const time = new Date().toLocaleTimeString();
            const line = `[${time}] ${message}`;
            
            this.logs.push(line);
            if (this.logs.length > CONFIG.DEBUG_MAX_LINES) {
                this.logs.shift();
            }

            this.content.innerHTML = this.logs.map(l => {
                let cls = 'log';
                if (level === 'error') cls = 'error';
                else if (level === 'warn') cls = 'warn';
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

    function checkPWA() {
        isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                window.navigator.standalone === true;
        
        Debug.log('PWA: ' + isPWA);

        const exitButtons = document.querySelectorAll('.btn--exit');
        const updateButton = document.querySelector('.btn--update');
        
        if (!isPWA) {
            exitButtons.forEach(btn => btn.style.display = 'none');
            updateButton.style.display = 'none';
            Debug.log('Web mode: buttons hidden');
        } else {
            exitButtons.forEach(btn => btn.style.display = 'block');
            Debug.log('PWA mode: exit buttons shown');        }
    }

    function updateVersionDisplay(shellVer, gameVer) {
        const shellEl = document.getElementById('shell-version');
        const gameEl = document.getElementById('game-version');
        
        Debug.log('Versions: shell=' + shellVer + ', game=' + gameVer);

        if (shellEl) {
            shellEl.textContent = 'v' + shellVer;
        } else {
            Debug.log('ERROR: shell-version not found', 'error');
        }

        if (gameEl) {
            gameEl.textContent = 'v' + gameVer;
        } else {
            Debug.log('ERROR: game-version not found', 'error');
        }
    }

    function initDebugToggle() {
        const versionsEl = document.querySelector('.versions');
        if (!versionsEl) {
            Debug.log('ERROR: .versions element not found', 'error');
            return;
        }

        Debug.log('Debug toggle: initialized on .versions');

        versionsEl.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            const now = Date.now();

            if (tapTimer === null) {
                tapCount = 1;
                tapTimer = now;
                Debug.log('Tap: 1 (start)');
            } else {
                const interval = now - tapTimer;

                if (interval > 400) {
                    tapCount = 1;
                    tapTimer = now;
                    Debug.log('Tap: 1 (reset, interval=' + interval + 'ms)');
                } else {
                    tapCount++;                    tapTimer = now;
                    Debug.log('Tap: ' + tapCount + ' (interval=' + interval + 'ms)');
                }
            }

            if (tapCount === 4) {
                Debug.log('Tap: 4 - TOGGLE DEBUG');
                tapCount = 0;
                tapTimer = null;
                Debug.toggle();
            }
        });

        Debug.log('Debug toggle: click listener attached');
    }

    function compareVersions(v1, v2) {
        return v1.localeCompare(v2, undefined, { numeric: true });
    }

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
                return;
            }

            const shellData = await shellRes.json();
            const gameData = await gameRes.json();

            remoteVersions.shell = shellData.version;
            remoteVersions.game = gameData.version;

            Debug.log('Remote: shell=' + remoteVersions.shell + ', game=' + remoteVersions.game);
            const storedShell = localStorage.getItem('shell_version') || CONFIG.SHELL_VERSION;
            const storedGame = localStorage.getItem('game_version') || CONFIG.GAME_VERSION_DEFAULT;

            Debug.log('Stored: shell=' + storedShell + ', game=' + storedGame);

            const shellUpdate = compareVersions(remoteVersions.shell, storedShell) > 0;
            const gameUpdate = compareVersions(remoteVersions.game, storedGame) > 0;

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
            CONFIG.REPO_PATH + 's-manifest.json',            CONFIG.REPO_PATH + 's-sw.js'
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
        setTimeout(() => location.reload(), 500);
    }

    function declineUpdate() {
        document.getElementById('update-modal').classList.remove('modal--visible');
        Debug.log('Update declined');
    }

    function showShell() {
        document.getElementById('game-screen').classList.remove('screen--active');
        document.getElementById('shell-screen').classList.add('screen--active');
        document.getElementById('close-screen').classList.remove('visible');        Debug.log('Show shell');
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
            Debug.log('Game started');
        } else {
            Debug.log('Game not ready', 'error');
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
        Debug.log('Popstate');
        if (e.state?.screen === 'game') showGame();
        else showShell();
    });

    function registerSW() {
        if (!isPWA) {
            Debug.log('SW: not PWA, skip registration');
            return;
        }

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register(CONFIG.REPO_PATH + 's-sw.js', { scope: CONFIG.REPO_PATH })
                .then(reg => {                    swRegistration = reg;
                    Debug.log('SW registered');
                })
                .catch(err => Debug.log('SW error: ' + err.message));
        }
    }

    function initEventListeners() {
        Debug.log('Init listeners');

        const shellScreen = document.getElementById('shell-screen');
        if (shellScreen) {
            shellScreen.addEventListener('click', function(e) {
                const btn = e.target.closest('[data-action]');
                if (!btn) return;

                Debug.log('Click: ' + btn.dataset.action);

                switch (btn.dataset.action) {
                    case 'play': startGame(); break;
                    case 'update': performUpdate(); break;
                    case 'exit': handleExit(); break;
                }
            });
        } else {
            Debug.log('ERROR: shell-screen not found', 'error');
        }

        const gameScreen = document.getElementById('game-screen');
        if (gameScreen) {
            gameScreen.addEventListener('click', function(e) {
                const btn = e.target.closest('[data-action]');
                if (!btn) return;

                switch (btn.dataset.action) {
                    case 'restart':
                        if (window.Game) window.Game.start();
                        break;
                    case 'exit': exitGame(); break;
                }
            });
        }

        const updateModal = document.getElementById('update-modal');
        if (updateModal) {
            updateModal.addEventListener('click', function(e) {
                const btn = e.target.closest('[data-action]');
                if (!btn) return;

                if (btn.dataset.action === 'confirm-update') performUpdate();                else if (btn.dataset.action === 'decline-update') declineUpdate();
            });
        }
    }

    async function init() {
        Debug.init();
        
        checkPWA();
        
        const storedShell = localStorage.getItem('shell_version') || CONFIG.SHELL_VERSION;
        const storedGame = localStorage.getItem('game_version') || CONFIG.GAME_VERSION_DEFAULT;
        updateVersionDisplay(storedShell, storedGame);
        
        initDebugToggle();
        registerSW();
        initEventListeners();
        await checkForUpdates();

        const params = new URLSearchParams(window.location.search);
        if (params.get('game') === 'cards' && window.Game) {
            window.Game.start();
            showGame();
        }
    }

    window.Shell = {
        versions: { shell: CONFIG.SHELL_VERSION, game: CONFIG.GAME_VERSION_DEFAULT },
        navigateToShell: showShell,
        debug: Debug
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

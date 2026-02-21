(function() {
    'use strict';

    const SHELL_VERSION = '2.2.0';
    const STORAGE = { SHELL_VERSION: 'shell_version', GAME_VERSION: 'game_version' };

    let isPWA = false;
    let swRegistration = null;

    // --- PWA Детекция ---
    function checkPWA() {
        isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                window.navigator.standalone === true;
        
        // Показываем кнопки только в PWA
        const exitButtons = document.querySelectorAll('.btn--exit');
        const updateButton = document.querySelector('.btn--update');
        
        if (!isPWA) {
            exitButtons.forEach(btn => btn.style.display = 'none');
            updateButton.style.display = 'none';
        }
    }

    // --- Версии ---
    function updateVersionDisplay(shellVer, gameVer) {
        const shellEl = document.getElementById('shell-version');
        const gameEl = document.getElementById('game-version');
        
        if (shellEl) shellEl.textContent = 'v' + shellVer;
        if (gameEl) gameEl.textContent = 'v' + gameVer;
    }

    async function checkVersions() {
        let shellVer = SHELL_VERSION;
        let gameVer = '1.0.0';

        try {
            const shellRes = await fetch('./s-version.json?t=' + Date.now());
            if (shellRes.ok) {
                const shellData = await shellRes.json();
                shellVer = shellData.version;
                localStorage.setItem(STORAGE.SHELL_VERSION, shellVer);
            }
        } catch (e) {
            shellVer = localStorage.getItem(STORAGE.SHELL_VERSION) || SHELL_VERSION;
        }

        try {
            const gameRes = await fetch('./g-version.json?t=' + Date.now());            if (gameRes.ok) {
                const gameData = await gameRes.json();
                gameVer = gameData.version;
                localStorage.setItem(STORAGE.GAME_VERSION, gameVer);
            }
        } catch (e) {
            gameVer = localStorage.getItem(STORAGE.GAME_VERSION) || '1.0.0';
        }

        updateVersionDisplay(shellVer, gameVer);
        return { shellVer, gameVer };
    }

    // --- Проверка обновлений ---
    function compareVersions(v1, v2) {
        return v1.localeCompare(v2, undefined, { numeric: true });
    }

    async function checkForUpdates() {
        if (!isPWA) return;

        try {
            const shellRes = await fetch('./s-version.json?t=' + Date.now());
            const gameRes = await fetch('./g-version.json?t=' + Date.now());
            
            if (!shellRes.ok || !gameRes.ok) return;

            const shellData = await shellRes.json();
            const gameData = await gameRes.json();

            const storedShell = localStorage.getItem(STORAGE.SHELL_VERSION) || SHELL_VERSION;
            const storedGame = localStorage.getItem(STORAGE.GAME_VERSION) || '1.0.0';

            const shellUpdate = compareVersions(shellData.version, storedShell) > 0;
            const gameUpdate = compareVersions(gameData.version, storedGame) > 0;

            if (shellUpdate || gameUpdate) {
                document.querySelector('.btn--update').classList.add('visible');
            }
        } catch (e) {
            console.log('Update check failed:', e);
        }
    }

    // --- Обновление с прогрессом ---
    async function performUpdate() {
        const modal = document.getElementById('update-modal');
        const progressBar = document.getElementById('update-progress');
        const progressText = document.getElementById('update-progress-text');
        const actions = document.getElementById('update-actions');
        modal.classList.add('modal--visible');
        progressBar.classList.add('visible');
        actions.style.display = 'none';

        const filesToCache = [
            './s-index.html', './s-styles.css', './s-app.js',
            './g-game.js', './g-styles.css', './g-config.js',
            './s-version.json', './g-version.json',
            './s-manifest.json', './s-sw.js'
        ];

        for (let i = 0; i < filesToCache.length; i++) {
            try {
                await fetch(filesToCache[i] + '?t=' + Date.now(), { cache: 'reload' });
                const percent = Math.round(((i + 1) / filesToCache.length) * 100);
                progressText.textContent = percent + '%';
                progressBar.querySelector('.progress-bar').style.width = percent + '%';
            } catch (e) {
                console.error('Failed to cache:', filesToCache[i]);
            }
        }

        // Активация новой версии SW
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
        }

        setTimeout(() => location.reload(), 1000);
    }

    function declineUpdate() {
        document.getElementById('update-modal').classList.remove('modal--visible');
    }

    // --- Навигация ---
    function showShell() {
        document.getElementById('game-screen').classList.remove('screen--active');
        document.getElementById('shell-screen').classList.add('screen--active');
        document.getElementById('close-screen').classList.remove('visible');
    }

    function showGame() {
        document.getElementById('shell-screen').classList.remove('screen--active');
        document.getElementById('game-screen').classList.add('screen--active');
    }

    function startGame() {
        if (window.Game && typeof window.Game.start === 'function') {
            window.Game.start();            history.pushState({ screen: 'game' }, '', '?game=cards');
            showGame();
        } else {
            console.error('Game API not available');
        }
    }

    function exitGame() {
        history.back();
    }

    function handleExit() {
        if (isPWA) {
            if (window.close) {
                window.close();
            }
            document.getElementById('close-screen').classList.add('visible');
        } else {
            showShell();
        }
    }

    // Обработка кнопки Back
    window.addEventListener('popstate', (e) => {
        if (e.state?.screen === 'game') {
            showGame();
        } else {
            showShell();
        }
    });

    // --- Service Worker ---
    function registerSW() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./s-sw.js', { scope: './' })
                .then(reg => {
                    swRegistration = reg;
                    reg.addEventListener('updatefound', () => {
                        const newWorker = reg.installing;
                        if (newWorker) {
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    checkForUpdates();
                                }
                            });
                        }
                    });
                })
                .catch(err => console.error('SW registration failed:', err));
        }    }

    // --- Обработчики событий ---
    function initEventListeners() {
        // Оболочка
        document.getElementById('shell-screen').addEventListener('click', e => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            switch (btn.dataset.action) {
                case 'play':
                    startGame();
                    break;
                case 'update':
                    performUpdate();
                    break;
                case 'exit':
                    handleExit();
                    break;
            }
        });

        // Игра
        document.getElementById('game-screen').addEventListener('click', e => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            switch (btn.dataset.action) {
                case 'restart':
                    if (window.Game && typeof window.Game.start === 'function') {
                        window.Game.start();
                    }
                    break;
                case 'exit':
                    exitGame();
                    break;
            }
        });

        // Модалка
        document.getElementById('update-modal').addEventListener('click', e => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            if (btn.dataset.action === 'confirm-update') {
                performUpdate();
            } else if (btn.dataset.action === 'decline-update') {
                declineUpdate();
            }
        });    }

    // --- Инициализация ---
    async function init() {
        checkPWA();
        registerSW();
        await checkVersions();
        checkForUpdates();
        initEventListeners();

        // Проверка URL при загрузке
        const params = new URLSearchParams(window.location.search);
        if (params.get('game') === 'cards' && window.Game) {
            window.Game.start();
            showGame();
        }
    }

    // Глобальный API для игр
    window.Shell = {
        versions: { shell: SHELL_VERSION, game: '1.0.0' },
        navigateToShell: showShell,
        showUpdateProgress: (percent) => {
            const progressText = document.getElementById('update-progress-text');
            if (progressText) progressText.textContent = percent + '%';
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

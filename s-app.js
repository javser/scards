(function() {
    'use strict';

    const SHELL_VERSION = '2.2.4';
    const STORAGE = { SHELL_VERSION: 'shell_version', GAME_VERSION: 'game_version' };
    const REPO_PATH = '/scards/'; // Для GitHub Pages

    let isPWA = false;
    let swRegistration = null;
    let updateAvailable = false;

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
            const shellRes = await fetch(REPO_PATH + 's-version.json?t=' + Date.now());
            if (shellRes.ok) {
                const shellData = await shellRes.json();
                shellVer = shellData.version;
                localStorage.setItem(STORAGE.SHELL_VERSION, shellVer);
            }
        } catch (e) {
            shellVer = localStorage.getItem(STORAGE.SHELL_VERSION) || SHELL_VERSION;
        }

        try {            const gameRes = await fetch(REPO_PATH + 'g-version.json?t=' + Date.now());
            if (gameRes.ok) {
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
        // Только PWA и только онлайн
        if (!isPWA || !navigator.onLine) {
            return;
        }

        try {
            const shellRes = await fetch(REPO_PATH + 's-version.json?t=' + Date.now());
            const gameRes = await fetch(REPO_PATH + 'g-version.json?t=' + Date.now());
            
            if (!shellRes.ok || !gameRes.ok) {
                console.log('Update check: network error');
                return;
            }

            const shellData = await shellRes.json();
            const gameData = await gameRes.json();

            const storedShell = localStorage.getItem(STORAGE.SHELL_VERSION) || SHELL_VERSION;
            const storedGame = localStorage.getItem(STORAGE.GAME_VERSION) || '1.0.0';

            const shellUpdate = compareVersions(shellData.version, storedShell) > 0;
            const gameUpdate = compareVersions(gameData.version, storedGame) > 0;

            if (shellUpdate || gameUpdate) {
                updateAvailable = true;
                document.querySelector('.btn--update').classList.add('visible');
                console.log('Update available:', { shell: shellUpdate, game: gameUpdate });
            }
        } catch (e) {
            console.log('Update check failed:', e);        }
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
            REPO_PATH + 's-index.html',
            REPO_PATH + 's-styles.css',
            REPO_PATH + 's-app.js',
            REPO_PATH + 'g-game.js',
            REPO_PATH + 'g-styles.css',
            REPO_PATH + 'g-config.js',
            REPO_PATH + 's-version.json',
            REPO_PATH + 'g-version.json',
            REPO_PATH + 's-manifest.json',
            REPO_PATH + 's-sw.js'
        ];

        const startTime = Date.now();
        const minDuration = 1000; // Минимум 1 секунда

        for (let i = 0; i < filesToCache.length; i++) {
            try {
                // Fetch с bypass кэша
                await fetch(filesToCache[i] + '?t=' + Date.now(), { 
                    cache: 'reload',
                    mode: 'cors'
                });
                
                const percent = Math.round(((i + 1) / filesToCache.length) * 100);
                progressText.textContent = percent + '%';
                progressBar.querySelector('.progress-bar').style.width = percent + '%';
                
                console.log(`Cached ${i + 1}/${filesToCache.length}: ${filesToCache[i]}`);
            } catch (e) {
                console.error('Failed to cache:', filesToCache[i], e);
                // Продолжаем даже если файл не загрузился
            }
        }

        // Ждём минимум 1 секунду для анимации        const elapsed = Date.now() - startTime;
        if (elapsed < minDuration) {
            await new Promise(resolve => setTimeout(resolve, minDuration - elapsed));
        }

        // Активация новой версии SW
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
        } else if (navigator.serviceWorker && swRegistration) {
            // Если контроллера нет, ждём активации
            await new Promise(resolve => {
                if (swRegistration.waiting) {
                    swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
                    resolve();
                } else {
                    swRegistration.addEventListener('updatefound', () => {
                        const newWorker = swRegistration.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed') {
                                newWorker.postMessage({ type: 'SKIP_WAITING' });
                                resolve();
                            }
                        });
                    });
                }
            });
        }

        // Перезагрузка
        setTimeout(() => location.reload(), 500);
    }

    function declineUpdate() {
        document.getElementById('update-modal').classList.remove('modal--visible');
        updateAvailable = false;
        document.querySelector('.btn--update').classList.remove('visible');
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
            window.Game.start();
            history.pushState({ screen: 'game' }, '', REPO_PATH + '?game=cards');
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
            navigator.serviceWorker.register(REPO_PATH + 's-sw.js', { scope: REPO_PATH })
                .then(reg => {
                    swRegistration = reg;
                    
                    // Проверка обновлений при установке нового SW
                    reg.addEventListener('updatefound', () => {
                        const newWorker = reg.installing;
                        if (newWorker) {
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    // Новый SW готов, показываем кнопку
                                    checkForUpdates();
                                }                            });
                        }
                    });

                    // Проверка при загрузке
                    if (reg.active) {
                        checkForUpdates();
                    }
                })
                .catch(err => console.error('SW registration failed:', err));
        }
    }

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
        });
    }

    // --- Инициализация ---
    async function init() {
        checkPWA();
        registerSW();
        await checkVersions();
        // checkForUpdates вызывается в registerSW после проверки SW
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

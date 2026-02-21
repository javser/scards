(function() {
    'use strict';

    const SHELL_VERSION = '2.2.6';
    const GAME_VERSION_DEFAULT = '1.0.0';
    const REPO_PATH = '/scards/';

    let isPWA = false;
    let swRegistration = null;
    let remoteVersions = { shell: null, game: null };

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

    // --- Отображение версий ---
    function updateVersionDisplay(shellVer, gameVer) {
        const shellEl = document.getElementById('shell-version');
        const gameEl = document.getElementById('game-version');
        
        if (shellEl) shellEl.textContent = 'v' + shellVer;
        if (gameEl) gameEl.textContent = 'v' + gameVer;
    }

    // --- Сравнение версий ---
    function compareVersions(v1, v2) {
        return v1.localeCompare(v2, undefined, { numeric: true });
    }

    // --- ШАГ 1: Запрос версий при старте ---
    async function checkForUpdates() {
        console.log('[UPDATE] Checking for updates...');

        // Только PWA и только онлайн
        if (!isPWA) {
            console.log('[UPDATE] Not PWA');
            return;
        }

        if (!navigator.onLine) {            console.log('[UPDATE] Offline');
            return;
        }

        try {
            // Запрашиваем версии с сервера (без кэша)
            const shellRes = await fetch(REPO_PATH + 's-version.json?t=' + Date.now());
            const gameRes = await fetch(REPO_PATH + 'g-version.json?t=' + Date.now());
            
            if (!shellRes.ok || !gameRes.ok) {
                console.log('[UPDATE] Network error');
                return;
            }

            const shellData = await shellRes.json();
            const gameData = await gameRes.json();

            remoteVersions.shell = shellData.version;
            remoteVersions.game = gameData.version;

            // Получаем сохранённые версии
            const storedShell = localStorage.getItem('shell_version') || SHELL_VERSION;
            const storedGame = localStorage.getItem('game_version') || GAME_VERSION_DEFAULT;

            // Сравниваем
            const shellUpdate = compareVersions(remoteVersions.shell, storedShell) > 0;
            const gameUpdate = compareVersions(remoteVersions.game, storedGame) > 0;

            console.log('[UPDATE] Versions:', {
                shell: { stored: storedShell, remote: remoteVersions.shell },
                game: { stored: storedGame, remote: remoteVersions.game },
                updateAvailable: shellUpdate || gameUpdate
            });

            // Показываем версии на экране
            updateVersionDisplay(remoteVersions.shell, remoteVersions.game);

            // ШАГ 2: Если есть новая версия → показать кнопку
            if (shellUpdate || gameUpdate) {
                document.querySelector('.btn--update').classList.add('visible');
                console.log('[UPDATE] Update button shown');
            } else {
                document.querySelector('.btn--update').classList.remove('visible');
                console.log('[UPDATE] No update available');
            }

        } catch (e) {
            console.log('[UPDATE] Check failed:', e);
        }
    }
    // --- ШАГ 3: Скачивание файлов с прогрессом ---
    async function performUpdate() {
        const modal = document.getElementById('update-modal');
        const progressBar = document.getElementById('update-progress');
        const progressText = document.getElementById('update-progress-text');
        const actions = document.getElementById('update-actions');

        // Показываем модалку с прогрессом
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

        // Скачиваем все файлы
        for (let i = 0; i < filesToCache.length; i++) {
            try {
                await fetch(filesToCache[i] + '?t=' + Date.now(), { 
                    cache: 'reload'
                });
                
                const percent = Math.round(((i + 1) / filesToCache.length) * 100);
                progressText.textContent = percent + '%';
                progressBar.querySelector('.progress-bar').style.width = percent + '%';
                
                console.log(`[UPDATE] Downloaded ${i + 1}/${filesToCache.length}`);
            } catch (e) {
                console.error('[UPDATE] Failed:', filesToCache[i]);
            }
        }

        // Ждём минимум 1 секунду для анимации
        const elapsed = Date.now() - startTime;
        if (elapsed < minDuration) {
            await new Promise(resolve => setTimeout(resolve, minDuration - elapsed));        }

        // Активация Service Worker
        if (swRegistration && swRegistration.waiting) {
            swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        // Сохраняем новые версии
        if (remoteVersions.shell) {
            localStorage.setItem('shell_version', remoteVersions.shell);
        }
        if (remoteVersions.game) {
            localStorage.setItem('game_version', remoteVersions.game);
        }

        console.log('[UPDATE] Download complete, restarting...');

        // ШАГ 4: Перезапуск приложения
        setTimeout(() => location.reload(), 500);
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
            window.Game.start();
            history.pushState({ screen: 'game' }, '', REPO_PATH + '?game=cards');
            showGame();
        }
    }

    function exitGame() {
        history.back();
    }

    function handleExit() {        if (isPWA) {
            if (window.close) window.close();
            document.getElementById('close-screen').classList.add('visible');
        } else {
            showShell();
        }
    }

    window.addEventListener('popstate', (e) => {
        if (e.state?.screen === 'game') showGame();
        else showShell();
    });

    // --- Service Worker ---
    function registerSW() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register(REPO_PATH + 's-sw.js', { scope: REPO_PATH })
                .then(reg => {
                    swRegistration = reg;
                    console.log('[SW] Registered');
                })
                .catch(err => console.error('[SW] Error:', err));
        }
    }

    // --- Обработчики ---
    function initEventListeners() {
        document.getElementById('shell-screen').addEventListener('click', e => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

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
        console.log('[APP] Starting...');
        
        checkPWA();
        
        // Показываем версии из localStorage сразу
        const storedShell = localStorage.getItem('shell_version') || SHELL_VERSION;
        const storedGame = localStorage.getItem('game_version') || GAME_VERSION_DEFAULT;
        updateVersionDisplay(storedShell, storedGame);
        
        registerSW();
        
        // Запрос версий с сервера → показать кнопку если есть обновление
        await checkForUpdates();
        
        initEventListeners();

        const params = new URLSearchParams(window.location.search);
        if (params.get('game') === 'cards' && window.Game) {
            window.Game.start();
            showGame();
        }
    }

    window.Shell = {
        versions: { shell: SHELL_VERSION, game: GAME_VERSION_DEFAULT },
        navigateToShell: showShell
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

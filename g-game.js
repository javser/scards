(function() {
    'use strict';

    const config = window.GameConfig;
    const state = { cards: [], matched: 0, locked: false };

    function init() {
        console.log(`[Game] ${config.name} v${config.version}`);
        if (window.Shell) {
            window.Shell.versions.game = config.version;
        }
    }

    function shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    function createBoard() {
        const container = document.getElementById('game-container');
        if (!container) return;

        container.innerHTML = '';
        const deck = shuffle([...config.cardValues, ...config.cardValues]);

        deck.forEach(val => {
            const card = document.createElement('div');
            card.className = 'card';
            card.dataset.value = val;
            card.innerHTML = `
                <div class="card__inner">
                    <div class="card__face card__face--back"></div>
                    <div class="card__face card__face--front">${val}</div>
                </div>
            `;
            card.onclick = () => flipCard(card);
            container.appendChild(card);
        });
    }

    function flipCard(card) {
        if (state.locked || card.classList.contains('card--flipped') || 
            card.classList.contains('card--matched')) return;

        card.classList.add('card--flipped');
        state.cards.push(card);
        if (state.cards.length === 2) {
            state.locked = true;
            const [c1, c2] = state.cards;

            if (c1.dataset.value === c2.dataset.value) {
                c1.classList.add('card--matched');
                c2.classList.add('card--matched');
                state.matched++;
                state.cards = [];
                state.locked = false;

                if (state.matched === config.pairs) {
                    setTimeout(() => {
                        alert('Поздравляю! Все пары найдены!');
                    }, 500);
                }
            } else {
                setTimeout(() => {
                    c1.classList.remove('card--flipped');
                    c2.classList.remove('card--flipped');
                    state.cards = [];
                    state.locked = false;
                }, config.matchDelay);
            }
        }
    }

    function start() {
        state.cards = [];
        state.matched = 0;
        state.locked = false;
        createBoard();
    }

    function exit() {
        history.back();
    }

    window.Game = {
        config: {
            id: config.id,
            name: config.name,
            version: config.version
        },
        init,
        start,
        exit
    };

    if (document.readyState === 'loading') {        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

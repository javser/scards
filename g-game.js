(function() {
    'use strict';

    const GameConfig = window.GameConfig || {};

    const Game = {
        config: {
            id: 'cards',
            name: 'Карточки',
            version: '1.0.3'
        },

        cards: [],
        flippedCards: [],
        matchedPairs: 0,
        totalPairs: 0,
        moves: 0,
        gameStarted: false,
        gameWon: false,

        init() {
            console.log('[Game] Карточки v' + this.config.version);
        },

        start() {
            this.cards = [];
            this.flippedCards = [];
            this.matchedPairs = 0;
            this.moves = 0;
            this.gameStarted = true;
            this.gameWon = false;

            const container = document.getElementById('game-container');
            if (!container) {
                console.error('[Game] Container not found');
                return;
            }

            container.innerHTML = '';

            const emojis = ['🍎', '🍊', '🍇', '🍓', '🍒', '🍑', '🍍', '🥝'];
            const deck = [...emojis, ...emojis];

            for (let i = deck.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [deck[i], deck[j]] = [deck[j], deck[i]];
            }

            this.totalPairs = emojis.length;
            const grid = document.createElement('div');
            grid.className = 'cards-grid';

            deck.forEach((emoji, index) => {
                const card = this.createCard(emoji, index);
                this.cards.push(card);
                grid.appendChild(card.element);
            });

            container.appendChild(grid);

            if (window.Shell?.debug) {
                window.Shell.debug.log('Game started: ' + this.totalPairs + ' pairs');
            }
        },

        createCard(emoji, index) {
            const card = {
                emoji: emoji,
                index: index,
                flipped: false,
                matched: false,
                element: null
            };

            const el = document.createElement('div');
            el.className = 'card';
            el.dataset.index = index;

            el.innerHTML = `
                <div class="card-inner">
                    <div class="card-front"></div>
                    <div class="card-back">${emoji}</div>
                </div>
            `;

            el.addEventListener('click', () => this.onCardClick(card));

            card.element = el;
            return card;
        },

        onCardClick(card) {
            if (!this.gameStarted || this.gameWon) return;
            if (card.flipped || card.matched) return;
            if (this.flippedCards.length >= 2) return;

            this.flipCard(card);
            this.flippedCards.push(card);
            if (this.flippedCards.length === 2) {
                this.moves++;
                setTimeout(() => this.checkMatch(), 600);
            }
        },

        flipCard(card) {
            card.flipped = true;
            card.element.classList.add('flipped');
        },

        unflipCard(card) {
            card.flipped = false;
            card.element.classList.remove('flipped');
        },

        checkMatch() {
            const [card1, card2] = this.flippedCards;

            if (card1.emoji === card2.emoji) {
                card1.matched = true;
                card2.matched = true;
                this.matchedPairs++;

                if (window.Shell?.debug) {
                    window.Shell.debug.log('Match! ' + this.matchedPairs + '/' + this.totalPairs);
                }

                if (this.matchedPairs === this.totalPairs) {
                    this.gameWon = true;
                    this.onGameWon();
                }
            } else {
                this.unflipCard(card1);
                this.unflipCard(card2);
            }

            this.flippedCards = [];
        },

        onGameWon() {
            if (window.Shell?.debug) {
                window.Shell.debug.log('Game Won! Moves: ' + this.moves);
            }

            this.showVictoryAnimation();

            setTimeout(() => {
                const modal = document.getElementById('victory-modal');
                if (modal) {                    modal.classList.add('modal--visible');
                    document.getElementById('victory-moves').textContent = this.moves;
                }
            }, 1500);
        },

        showVictoryAnimation() {
            const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#1abc9c'];
            const particleCount = 150;
            const duration = 3000;

            for (let i = 0; i < particleCount; i++) {
                this.createConfetti(colors, duration);
            }

            setTimeout(() => {
                const confetti = document.querySelectorAll('.confetti');
                confetti.forEach(c => c.remove());
            }, duration + 500);
        },

        createConfetti(colors, duration) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';

            const startLeft = Math.random() * 100;
            const rotation = Math.random() * 360;
            const size = Math.random() * 10 + 5;
            const color = colors[Math.floor(Math.random() * colors.length)];
            const delay = Math.random() * 500;

            confetti.style.left = startLeft + '%';
            confetti.style.width = size + 'px';
            confetti.style.height = size + 'px';
            confetti.style.backgroundColor = color;
            confetti.style.setProperty('--rotation', rotation + 'deg');
            confetti.style.animationDelay = delay + 'ms';
            confetti.style.animationDuration = (Math.random() * 1000 + 2000) + 'ms';

            document.body.appendChild(confetti);

            setTimeout(() => {
                confetti.remove();
            }, duration);
        },

        exit() {
            this.gameStarted = false;
            const container = document.getElementById('game-container');
            if (container) {                container.innerHTML = '';
            }
            const modal = document.getElementById('victory-modal');
            if (modal) {
                modal.classList.remove('modal--visible');
            }
            const confetti = document.querySelectorAll('.confetti');
            confetti.forEach(c => c.remove());
        }
    };

    window.Game = Game;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => Game.init());
    } else {
        Game.init();
    }
})();

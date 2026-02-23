(function() {
    'use strict';

    var Game = {
        config: {
            id: 'cards',
            name: 'Карточки',
            version: '1.0.5'
        },

        cards: [],
        flippedCards: [],
        matchedPairs: 0,
        totalPairs: 0,
        moves: 0,
        gameStarted: false,
        gameWon: false,

        init: function() {
            console.log('[Game] Карточки v' + this.config.version);
        },

        start: function() {
            var self = this;
            this.cards = [];
            this.flippedCards = [];
            this.matchedPairs = 0;
            this.moves = 0;
            this.gameStarted = true;
            this.gameWon = false;

            var container = document.getElementById('game-container');
            if (!container) {
                console.error('[Game] Container not found');
                return;
            }

            container.innerHTML = '';

            var emojis = ['🍎', '🍊', '🍇', '🍓', '🍒', '🍑', '🍍', '🥝'];
            var deck = emojis.concat(emojis);

            for (var i = deck.length - 1; i > 0; i--) {
                var j = Math.floor(Math.random() * (i + 1));
                var temp = deck[i];
                deck[i] = deck[j];
                deck[j] = temp;
            }

            this.totalPairs = emojis.length;
            var grid = document.createElement('div');
            grid.className = 'cards-grid';

            for (var k = 0; k < deck.length; k++) {
                var card = this.createCard(deck[k], k);
                this.cards.push(card);
                grid.appendChild(card.element);
            }

            container.appendChild(grid);

            var victoryModal = document.getElementById('victory-modal');
            if (victoryModal) {
                victoryModal.classList.remove('modal--visible');
            }

            if (window.Shell && window.Shell.debug) {
                window.Shell.debug.log('Game started: ' + this.totalPairs + ' pairs');
            }
        },

        createCard: function(emoji, index) {
            var self = this;
            var card = {
                emoji: emoji,
                index: index,
                flipped: false,
                matched: false,
                element: null
            };

            var el = document.createElement('div');
            el.className = 'card';

            var inner = document.createElement('div');
            inner.className = 'card-inner';

            var front = document.createElement('div');
            front.className = 'card-front';

            var back = document.createElement('div');
            back.className = 'card-back';
            back.textContent = emoji;

            inner.appendChild(front);
            inner.appendChild(back);
            el.appendChild(inner);

            el.addEventListener('click', function(e) {                e.stopPropagation();
                self.onCardClick(card);
            });

            card.element = el;
            return card;
        },

        onCardClick: function(card) {
            if (!this.gameStarted || this.gameWon) return;
            if (card.flipped || card.matched) return;
            if (this.flippedCards.length >= 2) return;

            this.flipCard(card);
            this.flippedCards.push(card);

            if (this.flippedCards.length === 2) {
                this.moves++;
                setTimeout(function() { self.checkMatch(); }, 600);
            }
        },

        flipCard: function(card) {
            card.flipped = true;
            card.element.classList.add('flipped');
        },

        unflipCard: function(card) {
            card.flipped = false;
            card.element.classList.remove('flipped');
        },

        checkMatch: function() {
            var self = this;
            if (this.flippedCards.length !== 2) return;

            var card1 = this.flippedCards[0];
            var card2 = this.flippedCards[1];

            if (card1.emoji === card2.emoji) {
                card1.matched = true;
                card2.matched = true;
                card1.element.classList.add('matched');
                card2.element.classList.add('matched');
                this.matchedPairs++;

                if (window.Shell && window.Shell.debug) {
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

        onGameWon: function() {
            var self = this;
            if (window.Shell && window.Shell.debug) {
                window.Shell.debug.log('Game Won! Moves: ' + this.moves);
            }

            this.showVictoryAnimation();

            setTimeout(function() {
                var modal = document.getElementById('victory-modal');
                if (modal) {
                    modal.classList.add('modal--visible');
                    var movesEl = document.getElementById('victory-moves');
                    if (movesEl) {
                        movesEl.textContent = self.moves;
                    }
                }
            }, 1000);
        },

        showVictoryAnimation: function() {
            var colors = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#1abc9c'];
            var particleCount = 100;

            for (var i = 0; i < particleCount; i++) {
                this.createConfetti(colors);
            }

            setTimeout(function() {
                var confetti = document.querySelectorAll('.confetti');
                for (var j = 0; j < confetti.length; j++) {
                    confetti[j].remove();
                }
            }, 3500);
        },

        createConfetti: function(colors) {
            var confetti = document.createElement('div');            confetti.className = 'confetti';
            confetti.style.pointerEvents = 'none';

            var startLeft = Math.random() * 100;
            var rotation = Math.random() * 360;
            var size = Math.random() * 10 + 5;
            var color = colors[Math.floor(Math.random() * colors.length)];
            var delay = Math.random() * 500;

            confetti.style.left = startLeft + '%';
            confetti.style.width = size + 'px';
            confetti.style.height = size + 'px';
            confetti.style.backgroundColor = color;
            confetti.style.setProperty('--rotation', rotation + 'deg');
            confetti.style.animationDelay = delay + 'ms';

            document.body.appendChild(confetti);
        },

        exit: function() {
            this.gameStarted = false;
            this.gameWon = false;
            var container = document.getElementById('game-container');
            if (container) {
                container.innerHTML = '';
            }
            var modal = document.getElementById('victory-modal');
            if (modal) {
                modal.classList.remove('modal--visible');
            }
            var confetti = document.querySelectorAll('.confetti');
            for (var i = 0; i < confetti.length; i++) {
                confetti[i].remove();
            }
        }
    };

    window.Game = Game;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { Game.init(); });
    } else {
        Game.init();
    }
})();

window.GameConfig = {
    id: 'cards',
    name: 'Карточки',
    version: '1.0.2',
    
    grid: { rows: 4, cols: 4 },
    pairs: 8,
    cardValues: [1, 2, 3, 4, 5, 6, 7, 8],
    
    flipDuration: 600,
    matchDelay: 1000,
    
    assets: {
        cards: './assets/cards/',
        sounds: './assets/sounds/'
    }
};

import Game from '../game.js';
import UI from '../ui.js';

export function handleGameStarted(gameState) {
    console.log('Game started:', gameState);
    const currentRoom = Game.getCurrentRoom();
    if (currentRoom) {
        currentRoom.gameState = gameState;
        Game.resetGuess();
        UI.showGameRoom(currentRoom);
        document.addEventListener('keydown', Game.handleKeyPress);
    }
}

export function handleUpdateCurrentGuess({ playerId, currentGuess, row }) {
    if (playerId !== Game.getPlayerId()) {
        console.log(`Update current guess for player ${playerId}: ${currentGuess} at row ${row}`);
        UI.updateCurrentGuess(playerId, currentGuess, row);
    }
}

export function handleGuessResult({ playerId, guess, result, row }) {
    console.log(`Guess result from player ${playerId}: ${guess} => ${result}`);
    const currentRoom = Game.getCurrentRoom();
    if (!currentRoom.gameState) {
        currentRoom.gameState = { guesses: [] };
    }
    currentRoom.gameState.guesses.push({ playerId, guess, result, row });
    UI.updateGameBoard(playerId, guess, result, row);
    if (playerId === Game.getPlayerId()) {
        Game.resetGuess();
    }
}

export function handleGameOver({ word, winner }) {
    console.log(`Game over! Word: ${word}, Winner: ${winner}`);
    document.removeEventListener('keydown', Game.handleKeyPress);
    UI.clearAllModals();
    const currentRoom = Game.getCurrentRoom();
    const winnerName = winner ? currentRoom.players.find(p => p.id === winner)?.name : 'No one';
    UI.showModal(`Game Over!\nThe word was: ${word}\nWinner: ${winnerName}`, { showCloseButton: true });
    Game.resetGame();
}

export function handleGameStateUpdate({ gameState, boardContent, room }) {
    console.log('Received game state update:', gameState);
    console.log('Received board content:', boardContent);
    console.log('Received room data:', room);

    if (room) {
        Game.setCurrentRoom(room);
        UI.showGameRoom(room);
    }

    const currentRoom = Game.getCurrentRoom();
    if (currentRoom) {
        currentRoom.gameState = gameState;
        UI.showGameBoards(gameState);

        Object.entries(boardContent).forEach(([playerIdKey, playerBoard]) => {
            playerBoard.forEach(({ guess, result }, row) => {
                if (guess && row < 6) {
                    UI.updateGameBoard(playerIdKey, guess, result, row);
                }
            });
        });

        if (gameState.guesses) {
            Game.updateCurrentRow(gameState.guesses.filter(g => g.playerId === Game.getPlayerId()).length);
            Game.resetGuess();
        }

        document.addEventListener('keydown', Game.handleKeyPress);
    } else {
        console.error('Received game state update but currentRoom is null');
    }
}

export function handleGameReset(message) {
    console.log('Game reset:', message);
    UI.showModal(message, { showCloseButton: true });
    Game.resetGame();
}

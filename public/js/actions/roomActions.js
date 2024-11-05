import Game from '../game.js';
import UI from '../ui.js';

export function handleRoomCreated(room) {
    console.log('Room created:', room);
    Game.setCurrentRoom(room);
    UI.showGameRoom(room);
}

export function handleRoomJoined({ room, gameState }) {
    console.log('Joined room:', room);
    Game.setCurrentRoom(room);
    UI.showGameRoom(room);
}

export function handleRoomListUpdate(rooms) {
    console.log('Room list updated:', rooms);
    UI.updateRoomList(rooms);
}

export function handleRoomStateUpdate({ room, gameState }) {
    console.log('Room state updated:', room, 'Game state:', gameState);
    Game.setCurrentRoom(room);

    if (gameState) {
        room.gameState = gameState;
    }

    UI.showGameRoom(room);

    if (gameState) {
        UI.showGameBoards(gameState);
    }
}

export function handleInvalidLobby(message) {
    console.warn('Invalid lobby:', message);
    UI.showModal(`${message} Redirecting to home page...`, { showCloseButton: true });
    setTimeout(() => {
        window.location.href = '/';
    }, 3000);
}

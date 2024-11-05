import Game from './game.js';
import SocketHandlers from './socketHandlers.js';
import UI from './ui.js';

const socket = io({
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
});

// Initialize modules
SocketHandlers.init(socket);
Game.init(socket);
UI.init();

document.addEventListener('DOMContentLoaded', () => {
    const urlPath = window.location.pathname;
    const roomPathMatch = urlPath.match(/^\/room\/([a-zA-Z0-9\-]+)$/);
    if (roomPathMatch) {
        const roomId = roomPathMatch[1];
        Game.setCurrentRoomId(roomId);
        const storedPlayerId = localStorage.getItem('playerId');
        if (storedPlayerId) {
            console.log('Attempting to join room:', roomId, 'with playerId:', storedPlayerId);
            localStorage.setItem('currentRoomId', roomId);
            Game.joinRoom(roomId, storedPlayerId);
        } else {
            console.log('New player joining room:', roomId);
            Game.joinRoom(roomId, null); // Pass null as playerId to indicate a new player
        }
    } else {
        UI.showHomePage();
    }
});

// Handle browser navigation (back button etc.)
window.addEventListener('popstate', (event) => {
    const urlPath = window.location.pathname;
    const roomPathMatch = urlPath.match(/^\/room\/([a-zA-Z0-9\-]+)$/);
    if (roomPathMatch) {
        const roomId = roomPathMatch[1];
        if (Game.getCurrentRoom() && Game.getCurrentRoom().id === roomId) {
            // Already in the room
            return;
        }
        // Attempt to reconnect
        Game.setCurrentRoomId(roomId);
        Game.joinRoom(roomId);
    } else {
        UI.showHomePage();
    }
});

// Handle socket reconnection events
socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    UI.showModal('Connection error. Please check your internet connection.', { showCloseButton: true });
});

socket.on('reconnect', (attemptNumber) => {
    console.log('Reconnected after', attemptNumber, 'attempts');
    Game.reconnectToGame();
});

socket.on('reconnect_failed', () => {
    console.error('Failed to reconnect');
    UI.showModal('Failed to reconnect to the server. Please refresh the page.', { showCloseButton: true });
});

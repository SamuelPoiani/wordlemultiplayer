// game.js
import UI from './ui.js';

const Game = (function() {
    let playerId;
    let currentRoom = null;
    let isCreator = false;
    let currentGuess = '';
    let currentRow = 0;
    let currentRoomId = null;
    let socket;
    let reconnectionAttempts = 0;
    const MAX_RECONNECTION_ATTEMPTS = 3;
    let reconnectTimer = null;

    function init(socketInstance) {
        socket = socketInstance;
        playerId = localStorage.getItem('playerId');
        if (!playerId) {
            playerId = generateUUID();
            localStorage.setItem('playerId', playerId);
        }
        socket.emit('identify', playerId);
    }

    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function handleKeyPress(event) {
        if (!currentRoom || !currentRoom.gameState) return;

        if (event.key === 'Enter') {
            if (currentGuess.length === 5) {
                socket.emit('makeGuess', { roomId: currentRoom.id, guess: currentGuess, row: currentRow });
                currentGuess = '';
                currentRow++;
            }
        } else if (event.key === 'Backspace') {
            currentGuess = currentGuess.slice(0, -1);
        } else if (event.key === 'Escape') {
            currentGuess = '';
        } else if (event.key.length === 1 && event.key.match(/[a-z]/i) && currentGuess.length < 5) {
            currentGuess += event.key.toUpperCase();
        }
        updateCurrentGuess();
        if (currentRoom && currentRoom.id) {
            socket.emit('updateCurrentGuess', { roomId: currentRoom.id, currentGuess, row: currentRow });
        }
    }

    function updateCurrentGuess() {
        UI.updateCurrentGuess(playerId, currentGuess, currentRow);
    }

    function resetGuess() {
        currentGuess = '';
        updateCurrentGuess();
    }

    function setReconnectionAttempts(attempts) {
        reconnectionAttempts = attempts;
    }

    function startReconnectTimer(disconnectedPlayerId) {
        clearReconnectTimer();
        reconnectTimer = setTimeout(() => {
            const currentRoom = getCurrentRoom();
            if (currentRoom && currentRoom.gameState) {
                UI.showModal('The other player failed to reconnect. The game has been reset.', { showCloseButton: true });
                resetGame();
            }
        }, 30000); // 30 segundos
    }

    function clearReconnectTimer() {
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
    }

    function resetGame() {
        if (currentRoom) {
            currentRoom.gameState = null;
            currentGuess = '';
            currentRow = 0;
            UI.showGameRoom(currentRoom);
        }
    }

    function updateCurrentRow(newRow) {
        currentRow = newRow;
    }

    function requestGameState(roomId) {
        socket.emit('requestGameState', roomId);
    }

    function setPlayerId(id) {
        playerId = id;
        localStorage.setItem('playerId', id);
    }

    function getPlayerId() {
        return playerId;
    }

    function setCurrentRoomId(id) {
        currentRoomId = id;
    }

    function getCurrentRoomId() {
        return currentRoomId;
    }

    function createRoom(roomName) {
        socket.emit('createRoom', roomName);
    }

    function joinRoom(roomId, playerIdParam = null) {
        console.log('Emitting joinRoom event:', { roomId, playerId: playerIdParam });
        socket.emit('joinRoom', { roomId, playerId: playerIdParam });
    }

    function setCurrentRoom(room) {
        currentRoom = room;
        isCreator = room.creator === playerId;
        // Remove the call to UI.showGameRoom from here
    }

    function getCurrentRoom() {
        return currentRoom;
    }

    function startGame(roomId) {
        socket.emit('startGame', roomId);
    }

    function kickPlayer(roomId, targetPlayerId) {
        if (isCreator && currentRoom && currentRoom.id === roomId) {
            console.log(`Attempting to kick player ${targetPlayerId} from room ${roomId}`);
            socket.emit('kickPlayer', { roomId, playerId: targetPlayerId });
        } else {
            console.error('Only the room creator can kick players.');
            UI.showModal('Only the room creator can kick players.', { showCloseButton: true });
        }
    }

    function reconnectToGame() {
        const storedRoomId = localStorage.getItem('currentRoomId');
        if (storedRoomId && playerId) {
            console.log('Reconnecting to room:', storedRoomId, 'with playerId:', playerId);
            joinRoom(storedRoomId, playerId);
            // Adicione esta linha para garantir que o evento de teclado seja adicionado
            document.addEventListener('keydown', handleKeyPress);
        }
    }

    function leaveRoom() {
        localStorage.removeItem('currentRoomId');
        currentRoom = null;
        currentRoomId = null;
        isCreator = false;
        currentGuess = '';
        currentRow = 0;
    }

    return {
        init,
        handleKeyPress,
        setPlayerId,
        getPlayerId,
        setCurrentRoomId,
        getCurrentRoomId,
        createRoom,
        joinRoom,
        setCurrentRoom,
        getCurrentRoom,
        startGame,
        kickPlayer,
        reconnectToGame,
        isCreator: () => isCreator,
        resetGuess,
        setReconnectionAttempts,
        startReconnectTimer,
        clearReconnectTimer,
        resetGame,
        updateCurrentRow,
        requestGameState,
        updateCurrentGuess,
        leaveRoom
    };
})();

export default Game;

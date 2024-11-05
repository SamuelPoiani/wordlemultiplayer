// socketHandlers.js

import * as Actions from './actions/index.js';

const SocketHandlers = (function() {
    function init(socket) {
        socket.on('assignedPlayerId', Actions.handleAssignedPlayerId);
        socket.on('identified', Actions.handleIdentified);
        socket.on('roomCreated', Actions.handleRoomCreated);
        socket.on('roomJoined', Actions.handleRoomJoined);
        socket.on('playerJoined', Actions.handlePlayerJoined);
        socket.on('playerKicked', Actions.handlePlayerKicked);
        socket.on('reconnected', Actions.handleReconnected);
        socket.on('playerReconnected', Actions.handlePlayerReconnected);
        socket.on('gameStarted', Actions.handleGameStarted);
        socket.on('updateCurrentGuess', Actions.handleUpdateCurrentGuess);
        socket.on('guessResult', Actions.handleGuessResult);
        socket.on('gameOver', Actions.handleGameOver);
        socket.on('roomListUpdate', Actions.handleRoomListUpdate);
        socket.on('joinError', Actions.handleJoinError);
        socket.on('startGameError', Actions.handleStartGameError);
        socket.on('playerLeft', Actions.handlePlayerLeft);
        socket.on('invalidLobby', Actions.handleInvalidLobby);
        socket.on('ownershipTransferred', Actions.handleOwnershipTransferred);
        socket.on('playerDisconnected', Actions.handlePlayerDisconnected);
        socket.on('gameStateUpdate', Actions.handleGameStateUpdate);
        socket.on('roomStateUpdate', Actions.handleRoomStateUpdate);
        socket.on('gameReset', Actions.handleGameReset);
        socket.on('kickedFromRoom', Actions.handleKickedFromRoom);
    }

    return {
        init
    };
})();

export default SocketHandlers;

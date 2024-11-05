import Game from '../game.js';
import UI from '../ui.js';

export function handleAssignedPlayerId(assignedPlayerId) {
    Game.setPlayerId(assignedPlayerId);
    localStorage.setItem('playerId', assignedPlayerId);
    console.log(`Assigned new playerId: ${assignedPlayerId}`);
}

export function handleIdentified() {
    const currentRoomId = Game.getCurrentRoomId();
    if (currentRoomId) {
        console.log('Identified. Attempting to join room:', currentRoomId);
        Game.joinRoom(currentRoomId, Game.getPlayerId());
    }
}

export function handlePlayerJoined(player) {
    console.log('Player joined:', player);
    const currentRoom = Game.getCurrentRoom();
    if (currentRoom && !currentRoom.players.find(p => p.id === player.id)) {
        currentRoom.players.push(player);
        UI.updatePlayersList();
        UI.showModal(`${player.name} has joined the room.`, { showCloseButton: true });
    }
}

export function handlePlayerKicked(kickedPlayerId) {
    console.log('Player kicked:', kickedPlayerId);
    const currentRoom = Game.getCurrentRoom();
    if (kickedPlayerId === Game.getPlayerId()) {
        Game.leaveRoom();
        UI.showHomePage();
        UI.showModal('You have been kicked from the room.', { showCloseButton: true });
    } else if (currentRoom) {
        currentRoom.players = currentRoom.players.filter(p => p.id !== kickedPlayerId);
        UI.updatePlayersList();
        UI.showModal(`A player has been kicked from the room.`, { showCloseButton: true });
    }
}

export function handleReconnected({ playerId: reconnectedPlayerId, roomId }) {
    console.log(`Player ${reconnectedPlayerId} reconnected to room ${roomId}`);
    Game.setCurrentRoomId(roomId);
    Game.requestGameState(roomId);
    document.addEventListener('keydown', Game.handleKeyPress);
}

export function handlePlayerReconnected({ playerId: reconnectedPlayerId, name }) {
    console.log(`Player reconnected: ${name} (${reconnectedPlayerId})`);
    const currentRoom = Game.getCurrentRoom();
    if (currentRoom) {
        const player = currentRoom.players.find(p => p.id === reconnectedPlayerId);
        if (player) {
            player.connected = true;
            currentRoom.players.forEach(p => p.connected = true);
            UI.updatePlayersList();
            
            if (currentRoom.gameState && reconnectedPlayerId !== Game.getPlayerId()) {
                UI.showModal(`${name} has reconnected.`, { showCloseButton: true });
            }
            Game.clearReconnectTimer();
        }
    }
}

export function handlePlayerLeft(playerIdLeft) {
    console.log('Player left:', playerIdLeft);
    const currentRoom = Game.getCurrentRoom();
    if (currentRoom) {
        currentRoom.players = currentRoom.players.filter(p => p.id !== playerIdLeft);
        if (currentRoom.creator === playerIdLeft) {
            currentRoom.creator = Game.getPlayerId();
            Game.setIsCreator(true);
            UI.showModal('You are now the room owner.', { showCloseButton: true });
        }
        UI.updatePlayersList();
        UI.showGameRoom(currentRoom);
    }
}

export function handleOwnershipTransferred(updatedRoom) {
    console.log('Ownership transferred:', updatedRoom.creator);
    Game.setCurrentRoom(updatedRoom);
    Game.setIsCreator(updatedRoom.creator === Game.getPlayerId());
    UI.showModal('You are now the owner of this room.', { showCloseButton: true });
    UI.showGameRoom(updatedRoom);
}

export function handlePlayerDisconnected(disconnectedPlayerId) {
    console.log('Player disconnected:', disconnectedPlayerId);
    const currentRoom = Game.getCurrentRoom();
    if (!currentRoom) return;

    const disconnectedPlayer = currentRoom.players.find(p => p.id === disconnectedPlayerId);
    if (!disconnectedPlayer) return;

    disconnectedPlayer.connected = false;
    UI.updatePlayersList();

    if (currentRoom.gameState) {
        UI.showModal(`Player ${disconnectedPlayer.name} has disconnected. Waiting for reconnection...`, { showCloseButton: true });
        Game.startReconnectTimer(disconnectedPlayerId);
    } else {
        UI.showModal(`Player ${disconnectedPlayer.name} has left the room.`, { showCloseButton: true });
    }
}

export function handleKickedFromRoom() {
    console.log('You have been kicked from the room.');
    Game.leaveRoom();
    UI.showHomePage();
    UI.showModal('You have been kicked from the room.', { showCloseButton: true });
}

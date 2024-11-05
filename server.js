const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Data Structures
const rooms = new Map(); // roomId -> room object
const boardContents = new Map(); // roomId -> { playerId: [ { guess, result } ] }
const playerSocketMap = new Map(); // playerId -> socket.id
const disconnectTimeouts = new Map(); // playerId -> timeout handle

// Initialize game state with a random word
function initializeGameState() {
    const words = ['APPLE', 'BEACH', 'CHAIR', 'DANCE', 'EAGLE'];
    return {
        word: words[Math.floor(Math.random() * words.length)],
        guesses: []
    };
}

// Check the player's guess against the target word
function checkGuess(guess, word) {
    const result = new Array(5).fill('wrong');
    const letterCounts = {};

    for (let i = 0; i < word.length; i++) {
        letterCounts[word[i]] = (letterCounts[word[i]] || 0) + 1;
    }

    // First pass for correct letters
    for (let i = 0; i < 5; i++) {
        if (guess[i] === word[i]) {
            result[i] = 'correct';
            letterCounts[guess[i]]--;
        }
    }

    // Second pass for misplaced letters
    for (let i = 0; i < 5; i++) {
        if (result[i] !== 'correct' && letterCounts[guess[i]] > 0) {
            result[i] = 'misplaced';
            letterCounts[guess[i]]--;
        }
    }

    return result;
}

// Generate a unique player ID
function generatePlayerId() {
    return 'player-' + Math.random().toString(36).substr(2, 9);
}

// Get room list update
function getRoomListUpdate() {
    return Array.from(rooms.values()).map(room => ({
        id: room.id,
        name: room.name,
        playerCount: room.players.filter(p => p.connected).length
    }));
}

// Handle socket connections
io.on('connection', (socket) => {
    console.log(`A user connected: ${socket.id}`);

    // Handle player identification
    socket.on('identify', (playerId) => {
        if (playerId) {
            playerSocketMap.set(playerId, socket.id);
            socket.playerId = playerId;
            console.log(`Player identified: ${playerId} with socket ID: ${socket.id}`);
            // Emit confirmation to the client
            socket.emit('identified');
        } else {
            console.warn('No playerId provided during identification.');
        }
    });

    // Emit initial room list to the newly connected client
    socket.emit('roomListUpdate', getRoomListUpdate());

    // Handle room creation
    socket.on('createRoom', (roomName) => {
        const roomId = uuidv4();
        const playerId = socket.playerId || generatePlayerId();

        // If the player doesn't have a playerId, assign one and inform the client
        if (!socket.playerId) {
            socket.playerId = playerId;
            socket.emit('assignedPlayerId', playerId);
            playerSocketMap.set(playerId, socket.id);
        }

        const room = {
            id: roomId,
            name: roomName,
            creator: playerId,
            players: [{
                id: playerId,
                socketId: socket.id,
                name: `Player ${playerId.substr(0, 4)}`,
                connected: true
            }],
            gameState: null
        };

        rooms.set(roomId, room);
        boardContents.set(roomId, {}); // Initialize empty board content for the room
        socket.join(roomId);
        socket.emit('roomCreated', room);
        io.emit('roomListUpdate', getRoomListUpdate());
    });

    // Handle joining a room
    socket.on('joinRoom', (data) => {
        const { roomId, playerId } = data;
        const room = rooms.get(roomId);

        if (!room) {
            socket.emit('joinError', 'Room does not exist.');
            return;
        }

        // Check if playerId is provided, if not, generate a new one
        const playerIdToUse = playerId || generatePlayerId();

        const existingPlayer = room.players.find(p => p.id === playerIdToUse);
        if (existingPlayer) {
            // Player is reconnecting
            existingPlayer.socketId = socket.id;
            existingPlayer.connected = true;
            playerSocketMap.set(playerIdToUse, socket.id);
            socket.join(roomId);
            socket.playerId = playerIdToUse;
            socket.emit('reconnected', { playerId: playerIdToUse, roomId });
            io.to(roomId).emit('playerReconnected', { playerId: existingPlayer.id, name: existingPlayer.name });

            // Cancel any pending removal timeout
            if (disconnectTimeouts.has(playerIdToUse)) {
                clearTimeout(disconnectTimeouts.get(playerIdToUse));
                disconnectTimeouts.delete(playerIdToUse);
            }
        } else {
            // New player joining
            const connectedPlayers = room.players.filter(p => p.connected);
            if (connectedPlayers.length >= 2) {
                socket.emit('joinError', 'Room is full.');
                return;
            }

            // Add new player
            const newPlayer = {
                id: playerIdToUse,
                socketId: socket.id,
                name: `Player ${playerIdToUse.substr(0, 4)}`,
                connected: true
            };
            room.players.push(newPlayer);

            playerSocketMap.set(playerIdToUse, socket.id);
            socket.join(roomId);
            socket.playerId = playerIdToUse;
            socket.emit('playerIdAssigned', playerIdToUse);
            io.to(roomId).emit('playerJoined', { id: playerIdToUse, name: newPlayer.name });
        }

        // Send room state to the joining player
        socket.emit('roomJoined', {
            room: {
                id: room.id,
                name: room.name,
                creator: room.creator,
                players: room.players.map(p => ({
                    id: p.id,
                    name: p.name,
                    connected: p.connected
                }))
            },
            gameState: room.gameState
        });

        // If game is in progress, send current game state
        if (room.gameState) {
            const currentBoardContent = boardContents.get(roomId) || {};
            socket.emit('gameStateUpdate', {
                gameState: room.gameState,
                boardContent: currentBoardContent
            });
        }

        // Update room list for all clients
        io.emit('roomListUpdate', getRoomListUpdate());

        // Broadcast the updated room state to all players in the room
        io.to(roomId).emit('roomStateUpdate', {
            room: {
                id: room.id,
                name: room.name,
                creator: room.creator,
                players: room.players.map(p => ({
                    id: p.id,
                    name: p.name,
                    connected: p.connected
                }))
            },
            gameState: room.gameState
        });
    });

    // Handle starting the game
    socket.on('startGame', (roomId) => {
        const room = rooms.get(roomId);
        if (!room) {
            socket.emit('startGameError', 'Room does not exist.');
            return;
        }

        if (room.creator !== socket.playerId) {
            socket.emit('startGameError', 'Only the room creator can start the game.');
            return;
        }

        if (room.players.filter(p => p.connected).length !== 2) {
            socket.emit('startGameError', 'The game requires 2 connected players to start.');
            return;
        }

        if (room.gameState) {
            socket.emit('startGameError', 'The game has already started.');
            return;
        }

        room.gameState = initializeGameState();
        io.to(roomId).emit('gameStarted', room.gameState);
    });

    // Handle making a guess
    socket.on('makeGuess', ({ roomId, guess, row }) => {
        const room = rooms.get(roomId);
        if (!room || !room.gameState) {
            return;
        }

        const playerId = socket.playerId;
        if (!playerId) {
            return;
        }

        const result = checkGuess(guess, room.gameState.word);
        const guessData = { playerId, guess, result, row };
        room.gameState.guesses.push(guessData);

        // Update board content
        const boardContent = boardContents.get(roomId) || {};
        if (!boardContent[playerId]) {
            boardContent[playerId] = [];
        }
        boardContent[playerId][row] = { guess, result };
        boardContents.set(roomId, boardContent);

        io.to(roomId).emit('guessResult', guessData);

        // Check for win or game over
        if (guess === room.gameState.word) {
            io.to(roomId).emit('gameOver', { word: room.gameState.word, winner: playerId });
            room.gameState = null;
            boardContents.delete(roomId); // Clear board content when game is over
        } else {
            const playerGuesses = room.gameState.guesses.filter(g => g.playerId === playerId).length;
            if (playerGuesses >= 6) {
                const otherPlayer = room.players.find(p => p.id !== playerId && p.connected);
                if (otherPlayer) {
                    const otherPlayerGuesses = room.gameState.guesses.filter(g => g.playerId === otherPlayer.id).length;
                    if (otherPlayerGuesses >= 6) {
                        io.to(roomId).emit('gameOver', { word: room.gameState.word, winner: null });
                        room.gameState = null;
                        boardContents.delete(roomId); // Clear board content when game is over
                    }
                } else {
                    io.to(roomId).emit('gameOver', { word: room.gameState.word, winner: null });
                    room.gameState = null;
                    boardContents.delete(roomId); // Clear board content when game is over
                }
            }
        }
    });

    // Handle updating current guess (for display purposes)
    socket.on('updateCurrentGuess', ({ roomId, currentGuess, row }) => {
        const room = rooms.get(roomId);
        if (!room || !room.gameState) {
            return;
        }

        const playerId = socket.playerId;
        if (!playerId) {
            return;
        }

        const boardContent = boardContents.get(roomId) || {};
        if (!boardContent[playerId]) {
            boardContent[playerId] = [];
        }
        boardContent[playerId][row] = { guess: currentGuess, result: null };
        boardContents.set(roomId, boardContent);

        io.to(roomId).emit('updateCurrentGuess', { playerId, currentGuess, row });
    });

    // Handle reconnection
    socket.on('reconnectToGame', ({ roomId, playerId }) => {
        const room = rooms.get(roomId);
        if (!room) {
            socket.emit('invalidLobby', 'This room does not exist.');
            return;
        }

        const player = room.players.find(p => p.id === playerId);
        if (!player) {
            socket.emit('invalidLobby', 'You are not a member of this room.');
            return;
        }

        if (player.connected) {
            socket.emit('joinError', 'Player is already connected.');
            return;
        }

        // Update player's socketId and mark as connected
        player.socketId = socket.id;
        player.connected = true;
        playerSocketMap.set(playerId, socket.id);
        socket.playerId = playerId;
        socket.join(roomId);

        // Cancel any pending removal timeout
        if (disconnectTimeouts.has(playerId)) {
            clearTimeout(disconnectTimeouts.get(playerId));
            disconnectTimeouts.delete(playerId);
        }

        // Emit reconnection events
        socket.emit('reconnected', { playerId, roomId });
        io.to(roomId).emit('playerReconnected', { playerId });

        // Send current game state
        if (room.gameState) {
            const currentBoardContent = boardContents.get(roomId) || {};
            socket.emit('gameStateUpdate', { gameState: room.gameState, boardContent: currentBoardContent });
        }
    });

    // Handle request for game state
    socket.on('requestGameState', (roomId) => {
        const room = rooms.get(roomId);
        if (room && room.gameState) {
            const boardContent = boardContents.get(roomId) || {};
            socket.emit('gameStateUpdate', {
                gameState: room.gameState,
                boardContent,
                room: {
                    id: room.id,
                    name: room.name,
                    creator: room.creator,
                    players: room.players.map(p => ({ id: p.id, name: p.name }))
                }
            });
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        let disconnectedPlayerId = null;
        for (let [pid, sid] of playerSocketMap.entries()) {
            if (sid === socket.id) {
                disconnectedPlayerId = pid;
                break;
            }
        }

        if (disconnectedPlayerId) {
            playerSocketMap.delete(disconnectedPlayerId);
            rooms.forEach((room, roomId) => {
                const playerIndex = room.players.findIndex(p => p.id === disconnectedPlayerId);
                if (playerIndex !== -1) {
                    const player = room.players[playerIndex];
                    player.connected = false;
                    io.to(roomId).emit('playerDisconnected', disconnectedPlayerId);

                    const timeoutHandle = setTimeout(() => {
                        const updatedRoom = rooms.get(roomId);
                        if (!updatedRoom) return;
                        const playerStillDisconnected = updatedRoom.players.find(p => p.id === disconnectedPlayerId && !p.connected);
                        if (playerStillDisconnected) {
                            handlePlayerRemoval(updatedRoom, roomId, playerIndex);
                        }
                    }, room.gameState ? 30000 : 2000); // 30 seconds if game started, 2 seconds if not

                    disconnectTimeouts.set(disconnectedPlayerId, timeoutHandle);
                }
            });
        }
    });

    // Handle kicking a player
    socket.on('kickPlayer', ({ roomId, playerId }) => {
        const room = rooms.get(roomId);
        if (!room) {
            return;
        }

        if (room.creator !== socket.playerId) {
            socket.emit('kickPlayerError', 'Only the room creator can kick players.');
            return;
        }

        const player = room.players.find(p => p.id === playerId);
        if (!player) {
            socket.emit('kickPlayerError', 'Player not found in the room.');
            return;
        }

        room.players = room.players.filter(p => p.id !== playerId);
        io.to(roomId).emit('playerKicked', playerId);
        const kickedSocket = io.sockets.sockets.get(player.socketId);
        if (kickedSocket) {
            kickedSocket.leave(roomId);
            kickedSocket.emit('kickedFromRoom');
        }

        // Reset the game if it was in progress
        if (room.gameState) {
            room.gameState = null;
            boardContents.delete(roomId);
            io.to(roomId).emit('gameReset', 'A player was kicked. The game has been reset.');
        }

        // Update room state for remaining players
        io.to(roomId).emit('roomStateUpdate', {
            room: {
                id: room.id,
                name: room.name,
                creator: room.creator,
                players: room.players.map(p => ({
                    id: p.id,
                    name: p.name,
                    connected: p.connected
                }))
            },
            gameState: room.gameState
        });

        // Update room list
        io.emit('roomListUpdate', getRoomListUpdate());

        // If no players left, remove the room
        if (room.players.length === 0) {
            rooms.delete(roomId);
            boardContents.delete(roomId);
            io.emit('roomListUpdate', getRoomListUpdate());
        }
    });
});

// Helper function to remove a player from a room
function handlePlayerRemoval(room, roomId, playerIndex) {
    const removedPlayer = room.players.splice(playerIndex, 1)[0];
    const removedPlayerId = removedPlayer.id;
    console.log(`Removing player ${removedPlayerId} from room ${roomId}`);

    if (room.players.length === 0) {
        rooms.delete(roomId);
        boardContents.delete(roomId);
        io.in(roomId).emit('invalidLobby', 'This room has been closed due to inactivity.');
    } else {
        if (room.creator === removedPlayerId) {
            // Transfer ownership to the first remaining player
            room.creator = room.players[0].id;
            io.to(room.players[0].socketId).emit('ownershipTransferred', room);
        }
        if (room.gameState && room.players.filter(p => p.connected).length < 2) {
            // If a player is removed during a game, end the game
            room.gameState = null;
            boardContents.delete(roomId);
            io.to(roomId).emit('gameOver', { word: 'Game stopped due to player leaving.', winner: null });
        } else {
            // Notify remaining players that a player has left
            io.to(roomId).emit('playerLeft', removedPlayerId);
        }
    }

    // Update room list
    io.emit('roomListUpdate', getRoomListUpdate());
}

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Serve the game page for specific room routes
app.get('/room/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

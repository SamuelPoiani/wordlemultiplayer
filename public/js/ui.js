// ui.js

import Game from './game.js';

const UI = (function() {
    const homePage = document.getElementById('home-page');
    const gamePage = document.getElementById('game-page');
    const createRoomForm = document.getElementById('create-room-form');
    const roomList = document.getElementById('room-list');

    function init() {
        createRoomForm.addEventListener('submit', handleCreateRoom);
    }

    function handleCreateRoom(e) {
        e.preventDefault();
        const roomName = document.getElementById('room-name').value.trim();
        if (roomName) {
            Game.createRoom(roomName);
        } else {
            showModal('Room name cannot be empty.', { showCloseButton: true });
        }
    }

    function showHomePage() {
        homePage.classList.remove('hidden');
        gamePage.classList.add('hidden');
        history.pushState(null, '', '/');
    }

    function showGameRoom(room) {
        if (!room) return;
        homePage.classList.add('hidden');
        gamePage.classList.remove('hidden');
        history.pushState(null, '', `/room/${room.id}`);

        gamePage.innerHTML = `
            <div class="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow-md">
                <h2 class="text-2xl font-bold mb-4">Room: ${room.name}</h2>
                <div id="players-list" class="mb-4"></div>
                <div id="game-controls" class="mb-4">
                    ${Game.isCreator() && !room.gameState ? '<button id="start-game" class="bg-green-500 text-white px-4 py-2 rounded">Start Game</button>' : ''}
                </div>
                <div id="game-boards" class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4"></div>
            </div>
        `;

        updatePlayersList();

        const startGameButton = document.getElementById('start-game');
        if (startGameButton) {
            startGameButton.addEventListener('click', () => Game.startGame(room.id));
        }

        if (room.gameState) {
            showGameBoards(room.gameState);
            // Adicione esta linha para garantir que o evento de teclado seja adicionado
            document.addEventListener('keydown', Game.handleKeyPress);
        }
    }

    function updatePlayersList() {
        const playersList = document.getElementById('players-list');
        const currentRoom = Game.getCurrentRoom();
        if (!currentRoom || !playersList) return;

        playersList.innerHTML = currentRoom.players.map(player => `
            <div class="flex items-center justify-between mb-2">
                <span>
                    ${player.name}${player.id === currentRoom.creator ? ' (Owner)' : ''}
                    ${player.connected === false ? ' <span class="text-red-500">(Disconnected)</span>' : ''}
                </span>
                ${Game.isCreator() && player.id !== Game.getPlayerId() ? `<button class="kick-player bg-red-500 text-white px-2 py-1 rounded" data-id="${player.id}">Kick</button>` : ''}
            </div>
        `).join('');

        // Add event listeners to kick buttons
        document.querySelectorAll('.kick-player').forEach(button => {
            button.addEventListener('click', () => {
                const targetPlayerId = button.dataset.id;
                const currentRoom = Game.getCurrentRoom();
                if (currentRoom) {
                    Game.kickPlayer(currentRoom.id, targetPlayerId);
                }
            });
        });
    }

    function showGameBoards(gameState) {
        const gameBoards = document.getElementById('game-boards');
        const currentRoom = Game.getCurrentRoom();
        if (!gameBoards) {
            console.error('Game boards container not found');
            return;
        }

        gameBoards.innerHTML = currentRoom.players.map(player => `
            <div class="game-board p-2">
                <h3 class="text-lg font-semibold mb-2">${player.id === Game.getPlayerId() ? 'Your Board' : `${player.name}'s Board`}</h3>
                <div id="board-${player.id}" class="grid grid-cols-5 gap-1">
                    ${Array(6).fill().map(() => `
                        ${Array(5).fill().map(() => '<div class="w-12 h-12 border border-gray-300 flex items-center justify-center text-2xl font-bold"></div>').join('')}
                    `).join('')}
                </div>
            </div>
        `).join('');

        console.log('Game boards created for players:', currentRoom.players.map(p => p.id));

        // Render existing guesses from gameState
        if (gameState.guesses) {
            gameState.guesses.forEach(({ playerId, guess, result, row }) => {
                updateGameBoard(playerId, guess, result, row);
            });
        }
    }

    function updateGameBoard(playerIdToUpdate, guess, result, row) {
        const board = document.getElementById(`board-${playerIdToUpdate}`);
        if (!board) {
            console.error(`Board not found for player ${playerIdToUpdate}`);
            return;
        }
        const currentRowCells = Array.from(board.children).slice(row * 5, (row + 1) * 5);
        for (let i = 0; i < 5; i++) {
            const cell = currentRowCells[i];
            if (!cell) {
                console.error(`Cell not found for row ${row}, column ${i}`);
                continue;
            }
            cell.textContent = guess[i];
            if (playerIdToUpdate === Game.getPlayerId()) {
                if (result[i] === 'correct') {
                    cell.classList.add('bg-green-500');
                } else if (result[i] === 'misplaced') {
                    cell.classList.add('bg-yellow-500');
                } else {
                    cell.classList.add('bg-gray-300');
                }
            } else {
                cell.classList.add('bg-gray-300');
            }
        }
    }

    function updateRoomList(rooms) {
        roomList.innerHTML = ''; // Clear existing list
        rooms.forEach(room => {
            const li = document.createElement('li');
            li.className = 'bg-gray-50 hover:bg-gray-100 py-2 px-4 rounded-md cursor-pointer';
            li.textContent = `${room.name} (${room.playerCount}/2)`;
            li.addEventListener('click', () => {
                Game.joinRoom(room.id, Game.getPlayerId());
            });
            roomList.appendChild(li);
        });
    }

    function showModal(message, options = {}) {
        clearAllModals();
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center';
        modal.innerHTML = `
            <div class="bg-white p-8 rounded-xl shadow-md text-center">
                <p class="text-xl mb-4 whitespace-pre-line">${message}</p>
                ${options.showReconnectButton ? '<button id="reconnect-button" class="bg-blue-500 text-white px-4 py-2 rounded mr-2">Reconnect</button>' : ''}
                ${options.showCloseButton ? '<button id="close-modal" class="bg-gray-500 text-white px-4 py-2 rounded">Close</button>' : ''}
            </div>
        `;
        document.body.appendChild(modal);

        if (options.showReconnectButton) {
            document.getElementById('reconnect-button').addEventListener('click', () => {
                Game.reconnectToGame();
                modal.remove();
            });
        }

        if (options.showCloseButton) {
            document.getElementById('close-modal').addEventListener('click', () => {
                modal.remove();
            });
        }

        return modal;
    }

    function clearAllModals() {
        document.querySelectorAll('.fixed').forEach(modal => modal.remove());
    }

    function updateCurrentGuess(playerId, guess, row) {
        const board = document.getElementById(`board-${playerId}`);
        if (!board) return;
        const currentRowCells = Array.from(board.children).slice(row * 5, (row + 1) * 5);
        currentRowCells.forEach((cell, index) => {
            cell.textContent = guess[index] || '';
        });
    }

    return {
        init,
        showHomePage,
        showGameRoom,
        updatePlayersList,
        showGameBoards,
        updateGameBoard,
        updateRoomList,
        showModal,
        clearAllModals,
        updateCurrentGuess
    };
})();

export default UI;

import UI from '../ui.js';

export function handleJoinError(error) {
    console.log('Join error:', error);
    if (error === 'Room is full.' || error === 'Room does not exist.') {
        UI.showModal(`${error} Redirecting to home page...`, { showCloseButton: true });
        setTimeout(() => {
            window.location.href = '/';
        }, 3000);
    } else {
        UI.showModal(error, { showCloseButton: true });
    }
}

export function handleStartGameError(error) {
    console.log('Start game error:', error);
    UI.showModal(error, { showCloseButton: true });
}

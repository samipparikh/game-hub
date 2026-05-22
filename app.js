const db = firebase.database();
const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

const GAMES = [
    { id: 'flip7', name: 'FLIP 7', icon: '🎴', path: 'rooms', url: 'https://samipparikh.github.io/flip7/' },
    { id: 'liars-dice', name: "LIAR'S DICE", icon: '🎲', path: 'liars-dice-rooms', url: 'https://samipparikh.github.io/liars-dice/' },
    { id: 'booray', name: 'BOORAY', icon: '🃏', path: 'booray-rooms', url: 'https://samipparikh.github.io/booray/' },
    { id: 'uno', name: 'UNO', icon: '🟥', path: 'uno-rooms', url: 'https://samipparikh.github.io/uno/' },
];

function listenForSessions() {
    GAMES.forEach(game => {
        db.ref(game.path).orderByChild('state').equalTo('lobby').on('value', (snapshot) => {
            const badge = document.getElementById(`sessions-${game.id}`);
            if (!badge) return;
            const rooms = snapshot.exists() ? snapshot.val() : {};
            const count = Object.keys(rooms).length;

            if (count > 0) {
                badge.innerHTML = `<span class="session-badge">${count} waiting</span>`;
                badge.classList.add('has-sessions');
            } else {
                badge.innerHTML = '';
                badge.classList.remove('has-sessions');
            }

            renderAllActiveSessions();
        });
    });
}

function renderAllActiveSessions() {
    const container = document.getElementById('all-active-games');
    const promises = GAMES.map(game => {
        return db.ref(game.path).orderByChild('state').equalTo('lobby').once('value').then(snapshot => {
            if (!snapshot.exists()) return [];
            const rooms = snapshot.val();
            return Object.entries(rooms).map(([code, room]) => {
                const playerCount = Object.keys(room.players || {}).length;
                const hostPlayer = Object.values(room.players || {})[0];
                return { game, code, playerCount, hostName: hostPlayer ? hostPlayer.name : 'Unknown' };
            });
        });
    });

    Promise.all(promises).then(results => {
        const allSessions = results.flat();

        if (allSessions.length === 0) {
            container.innerHTML = '<p class="no-games">No active games right now. Start one!</p>';
            return;
        }

        container.innerHTML = allSessions.map(s => `
            <a href="${s.game.url}#join=${s.code}" class="active-game-row">
                <span class="active-game-icon">${s.game.icon}</span>
                <div class="active-game-details">
                    <span class="active-game-name">${s.game.name}</span>
                    <span class="active-game-meta">Host: ${s.hostName}</span>
                </div>
                <div class="active-game-right">
                    <span class="active-game-players">${s.playerCount}/6</span>
                    <span class="join-btn">JOIN</span>
                </div>
            </a>
        `).join('');
    });
}

// Room Management
let roomsVisible = false;

document.getElementById('btn-show-rooms').addEventListener('click', () => {
    roomsVisible = !roomsVisible;
    const container = document.getElementById('room-list');
    const btn = document.getElementById('btn-show-rooms');
    if (roomsVisible) {
        container.style.display = 'block';
        btn.textContent = 'Hide Rooms';
        loadAllRooms();
    } else {
        container.style.display = 'none';
        btn.textContent = 'Show All Rooms';
    }
});

function loadAllRooms() {
    const container = document.getElementById('room-list');
    container.innerHTML = '<p class="no-games">Loading...</p>';

    const promises = GAMES.map(game => {
        return db.ref(game.path).once('value').then(snapshot => {
            if (!snapshot.exists()) return [];
            const rooms = snapshot.val();
            return Object.entries(rooms).map(([code, room]) => {
                const playerCount = Object.keys(room.players || {}).length;
                const createdAt = room.createdAt || 0;
                const age = Date.now() - createdAt;
                const ageDays = Math.floor(age / (24 * 60 * 60 * 1000));
                const ageText = ageDays > 0 ? `${ageDays}d ago` : 'Today';
                return { game, code, playerCount, state: room.state || 'unknown', createdAt, ageText, ageDays };
            });
        });
    });

    Promise.all(promises).then(results => {
        const allRooms = results.flat().sort((a, b) => b.createdAt - a.createdAt);

        if (allRooms.length === 0) {
            container.innerHTML = '<p class="no-games">No rooms found</p>';
            return;
        }

        container.innerHTML = allRooms.map(r => `
            <div class="room-row ${r.ageDays >= 5 ? 'stale' : ''}">
                <div class="room-row-info">
                    <span class="room-row-icon">${r.game.icon}</span>
                    <span class="room-row-code">${r.code}</span>
                    <span class="room-row-state">${r.state}</span>
                    <span class="room-row-age">${r.ageText}</span>
                    <span class="room-row-players">${r.playerCount}p</span>
                </div>
                <button class="btn-shutdown" data-path="${r.game.path}" data-code="${r.code}">Shut Down</button>
            </div>
        `).join('');

        container.querySelectorAll('.btn-shutdown').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const path = btn.dataset.path;
                const code = btn.dataset.code;
                shutdownRoom(path, code, btn);
            });
        });
    });
}

function shutdownRoom(path, code, btnEl) {
    if (!confirm(`Shut down room ${code}?`)) return;
    db.ref(`${path}/${code}`).remove().then(() => {
        btnEl.parentElement.remove();
    });
}

// Auto-cleanup: remove rooms older than 5 days
function autoCleanup() {
    const cutoff = Date.now() - FIVE_DAYS_MS;
    GAMES.forEach(game => {
        db.ref(game.path).orderByChild('createdAt').endAt(cutoff).once('value').then(snapshot => {
            if (!snapshot.exists()) return;
            const staleRooms = snapshot.val();
            Object.keys(staleRooms).forEach(code => {
                db.ref(`${game.path}/${code}`).remove();
            });
        });
    });
}

listenForSessions();
autoCleanup();

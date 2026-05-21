const PASSWORD = 'TipsyPutt';
const db = firebase.database();

const GAMES = [
    { id: 'flip7', name: 'FLIP 7', icon: '🎴', path: 'rooms', url: 'https://samipparikh.github.io/flip7/' },
    { id: 'liars-dice', name: "LIAR'S DICE", icon: '🎲', path: 'liars-dice-rooms', url: 'https://samipparikh.github.io/liars-dice/' },
    { id: 'booray', name: 'BOORAY', icon: '🃏', path: 'booray-rooms', url: 'https://samipparikh.github.io/booray/' },
];

function checkAuth() {
    if (sessionStorage.getItem('game_hub_auth') === 'true') {
        showHub();
        return;
    }

    document.getElementById('login-screen').style.display = 'block';

    document.getElementById('btn-login').addEventListener('click', attemptLogin);
    document.getElementById('password-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') attemptLogin();
    });
}

function attemptLogin() {
    const input = document.getElementById('password-input').value;
    if (input === PASSWORD) {
        sessionStorage.setItem('game_hub_auth', 'true');
        showHub();
    } else {
        document.getElementById('login-error').textContent = 'Incorrect password';
        document.getElementById('password-input').value = '';
    }
}

function showHub() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    listenForSessions();
}

function listenForSessions() {
    GAMES.forEach(game => {
        db.ref(game.path).orderByChild('state').equalTo('lobby').on('value', (snapshot) => {
            const badge = document.getElementById(`sessions-${game.id}`);
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

checkAuth();

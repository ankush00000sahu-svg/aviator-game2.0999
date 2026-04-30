const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);

// ✅ CORS FIX (future safe)
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// ❌ OPTIONAL: agar Netlify use kar rahe ho to isko hata sakte ho
app.use(express.static(path.join(__dirname, 'public')));

// ============ DATA STORE ============
const DATA_FILE = path.join(__dirname, 'data.json');

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Data load error:', e);
  }

  return {
    users: {},
    deposits: [],
    withdraws: [],
    gameHistory: [],
    admin: {
      phone: '7903368331',
      password: 'admin79911'
    }
  };
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Save error:', e);
  }
}

let data = loadData();

// ============ USER ID ============
function generateUserId() {
  return 'U' + Date.now().toString(36).toUpperCase() +
    Math.random().toString(36).substring(2, 6).toUpperCase();
}

// ============ ROUTES ============

// LOGIN
app.post('/api/login', (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.json({ success: false, message: 'Phone required' });
  }

  let user = Object.values(data.users).find(u => u.phone === phone);

  if (!user) {
    const userId = generateUserId();
    user = { userId, phone, balance: 0, name: '' };
    data.users[userId] = user;
    saveData();
  }

  res.json({ success: true, user });
});

// GET USER
app.get('/api/user/:userId', (req, res) => {
  const user = data.users[req.params.userId];
  if (!user) return res.json({ success: false });

  res.json({ success: true, user });
});

// ============ SOCKET ============
let gameState = {
  status: 'waiting',
  multiplier: 1.00,
  crashPoint: 0,
  history: [],
  round: 0,
  timer: 12
};

function generateCrashPoint() {
  return Math.round((1 + Math.random() * 10) * 100) / 100;
}

function startGame() {
  gameState.status = 'flying';
  gameState.multiplier = 1.00;
  gameState.crashPoint = generateCrashPoint();
  gameState.round++;

  io.emit('gameStart', { round: gameState.round });

  const fly = setInterval(() => {
    if (gameState.status !== 'flying') return clearInterval(fly);

    gameState.multiplier += 0.02;

    if (gameState.multiplier >= gameState.crashPoint) {
      clearInterval(fly);
      gameState.status = 'crashed';

      io.emit('gameCrashed', {
        multiplier: gameState.crashPoint
      });

      setTimeout(() => {
        gameState.status = 'waiting';
        startGame();
      }, 5000);

    } else {
      io.emit('multiplierUpdate', {
        multiplier: gameState.multiplier
      });
    }
  }, 100);
}

// SOCKET CONNECT
io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  socket.on('joinGame', (userData) => {
    socket.userId = userData.userId;

    socket.emit('gameState', {
      ...gameState,
      balance: data.users[socket.userId]?.balance || 0
    });
  });

  socket.on('disconnect', () => {
    console.log('Disconnected:', socket.id);
  });
});

// START GAME
setTimeout(() => startGame(), 3000);

// PORT
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});

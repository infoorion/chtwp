const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Persistence Setup
const DB_PATH = process.env.NODE_ENV === 'production' 
  ? '/opt/render/project/src/db.json' // Path for Render persistent disk
  : path.join(__dirname, 'db.json');

const initDB = () => {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ users: {}, messages: [] }, null, 2));
  }
};
const getDB = () => JSON.parse(fs.readFileSync(DB_PATH));
const saveDB = (data) => fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));

initDB();

// API Endpoints
app.get('/api/user/:phone', (req, res) => {
  const { phone } = req.params;
  const db = getDB();
  res.json(db.users[phone] || {});
});

app.post('/api/login', (req, res) => {
  const { phone, username } = req.body;
  const db = getDB();
  if (!db.users[phone]) {
    if (!username) return res.status(400).json({ error: 'Username required' });
    db.users[phone] = {
      id: String(phone),
      phone: String(phone),
      username,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
      joinedAt: new Date().toISOString()
    };
    saveDB(db);
  }
  res.json(db.users[phone]);
});

app.get('/api/messages/:userA/:userB', (req, res) => {
  const { userA, userB } = req.params;
  const db = getDB();
  const thread = db.messages.filter(m => 
    (String(m.sender_id) === String(userA) && String(m.receiver_id) === String(userB)) || 
    (String(m.sender_id) === String(userB) && String(m.receiver_id) === String(userA))
  );
  res.json(thread);
});

app.get('/api/conversations/:userId', (req, res) => {
  const { userId } = req.params;
  const db = getDB();
  const chattedWithIds = new Set();
  db.messages.forEach(m => {
    if (String(m.sender_id) === String(userId)) chattedWithIds.add(String(m.receiver_id));
    if (String(m.receiver_id) === String(userId)) chattedWithIds.add(String(m.sender_id));
  });
  const conversations = Array.from(chattedWithIds).map(id => {
    const contact = db.users[id];
    if (!contact) return null;
    const lastMsg = db.messages.filter(m => 
      (String(m.sender_id) === String(userId) && String(m.receiver_id) === String(id)) || 
      (String(m.sender_id) === String(id) && String(m.receiver_id) === String(userId))
    ).pop();
    return { ...contact, lastMessage: lastMsg };
  }).filter(c => c !== null);
  res.json(conversations);
});

// --- PRODUCTION: Serve Frontend ---
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '../dist');
  app.use(express.static(buildPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

// Socket.io
const onlineUsers = new Map();
io.on('connection', (socket) => {
  socket.on('join', (user) => {
    if (!user || !user.id) return;
    socket.join(String(user.id));
    onlineUsers.set(socket.id, user);
    io.emit('presence', Array.from(onlineUsers.values()));
  });

  socket.on('get_presence', () => {
    socket.emit('presence', Array.from(onlineUsers.values()));
  });

  socket.on('send_message', (msg) => {
    const db = getDB();
    const newMsg = {
      ...msg,
      id: Date.now(),
      created_at: new Date().toISOString()
    };
    db.messages.push(newMsg);
    saveDB(db);
    io.to(String(newMsg.receiver_id)).emit('receive_message', newMsg);
    io.to(String(newMsg.sender_id)).emit('receive_message', newMsg);
  });

  socket.on('disconnect', () => {
    const user = onlineUsers.get(socket.id);
    if (user) {
      onlineUsers.delete(socket.id);
      io.emit('presence', Array.from(onlineUsers.values()));
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

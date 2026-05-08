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

const DB_PATH = process.env.NODE_ENV === 'production' ? '/opt/render/project/src/db.json' : path.join(__dirname, 'db.json');
const initDB = () => { if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify({ users: {}, messages: [] }, null, 2)); };
const getDB = () => JSON.parse(fs.readFileSync(DB_PATH));
const saveDB = (data) => fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
initDB();

// API
app.get('/api/user/:phone', (req, res) => res.json(getDB().users[req.params.phone] || {}));
app.post('/api/login', (req, res) => {
  const { phone, username } = req.body;
  const db = getDB();
  if (!db.users[phone]) {
    db.users[phone] = { id: String(phone), phone: String(phone), username, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`, joinedAt: new Date().toISOString() };
    saveDB(db);
  }
  res.json(db.users[phone]);
});

app.post('/api/update-profile', (req, res) => {
  const { userId, avatar } = req.body;
  const db = getDB();
  if (db.users[userId]) {
    db.users[userId].avatar = avatar;
    saveDB(db);
    res.json(db.users[userId]);
  } else { res.status(404).json({ error: 'User not found' }); }
});

app.get('/api/messages/:userA/:userB', (req, res) => {
  const { userA, userB } = req.params;
  const db = getDB();
  res.json(db.messages.filter(m => !m.is_deleted && ((String(m.sender_id) === String(userA) && String(m.receiver_id) === String(userB)) || (String(m.sender_id) === String(userB) && String(m.receiver_id) === String(userA)))));
});

app.get('/api/conversations/:userId', (req, res) => {
  const { userId } = req.params;
  const db = getDB();
  const ids = new Set();
  db.messages.forEach(m => {
    if (String(m.sender_id) === String(userId)) ids.add(String(m.receiver_id));
    if (String(m.receiver_id) === String(userId)) ids.add(String(m.sender_id));
  });
  res.json(Array.from(ids).map(id => {
    const contact = db.users[id];
    if (!contact) return null;
    const lastMsg = db.messages.filter(m => !m.is_deleted && ((String(m.sender_id) === String(userId) && String(m.receiver_id) === String(id)) || (String(m.sender_id) === String(id) && String(m.receiver_id) === String(userId)))).pop();
    return { ...contact, lastMessage: lastMsg };
  }).filter(Boolean));
});

if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '../dist');
  app.use(express.static(buildPath));
  app.get('*', (req, res) => res.sendFile(path.join(buildPath, 'index.html')));
}

// Socket
const onlineUsers = new Map();
io.on('connection', (socket) => {
  socket.on('join', (user) => {
    socket.join(String(user.id));
    onlineUsers.set(socket.id, user);
    io.emit('presence', Array.from(onlineUsers.values()));
  });

  socket.on('send_message', (msg) => {
    const db = getDB();
    const newMsg = { ...msg, id: Date.now(), created_at: new Date().toISOString(), status: 'sent', is_deleted: false };
    db.messages.push(newMsg);
    saveDB(db);
    io.to(String(newMsg.receiver_id)).emit('receive_message', newMsg);
    io.to(String(newMsg.sender_id)).emit('receive_message', newMsg);
  });

  socket.on('mark_seen', ({ senderId, receiverId }) => {
    const db = getDB();
    let updated = false;
    db.messages.forEach(m => {
      if (String(m.sender_id) === String(senderId) && String(m.receiver_id) === String(receiverId) && m.status !== 'seen') {
        m.status = 'seen';
        updated = true;
      }
    });
    if (updated) {
      saveDB(db);
      io.to(String(senderId)).emit('status_update', { receiverId, status: 'seen' });
    }
  });

  socket.on('delete_message', ({ messageId, userId }) => {
    const db = getDB();
    const msg = db.messages.find(m => m.id === messageId);
    if (msg && String(msg.sender_id) === String(userId)) {
      msg.is_deleted = true;
      saveDB(db);
      io.to(String(msg.receiver_id)).emit('message_deleted', messageId);
      io.to(String(msg.sender_id)).emit('message_deleted', messageId);
    }
  });

  socket.on('disconnect', () => {
    const u = onlineUsers.get(socket.id);
    if (u) { onlineUsers.delete(socket.id); io.emit('presence', Array.from(onlineUsers.values())); }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server on ${PORT}`));

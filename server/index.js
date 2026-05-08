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
  const phoneStr = String(phone);
  if (!db.users[phoneStr]) {
    db.users[phoneStr] = { id: phoneStr, phone: phoneStr, username, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`, joinedAt: new Date().toISOString() };
    saveDB(db);
  }
  res.json(db.users[phoneStr]);
});

app.post('/api/update-profile', (req, res) => {
  const { userId, avatar } = req.body;
  const db = getDB();
  const uid = String(userId);
  if (db.users[uid]) {
    db.users[uid].avatar = avatar;
    saveDB(db);
    res.json(db.users[uid]);
  } else { res.status(404).json({ error: 'User not found' }); }
});

app.get('/api/messages/:userA/:userB', (req, res) => {
  const { userA, userB } = req.params;
  const db = getDB();
  const uA = String(userA);
  const uB = String(userB);
  res.json(db.messages.filter(m => !m.is_deleted && ((String(m.sender_id) === uA && String(m.receiver_id) === uB) || (String(m.sender_id) === uB && String(m.receiver_id) === uA))));
});

app.get('/api/conversations/:userId', (req, res) => {
  const { userId } = req.params;
  const uid = String(userId);
  const db = getDB();
  const chatPartners = new Set();
  
  db.messages.forEach(m => {
    const s = String(m.sender_id);
    const r = String(m.receiver_id);
    if (s === uid) chatPartners.add(r);
    if (r === uid) chatPartners.add(s);
  });

  const conversations = Array.from(chatPartners).map(pid => {
    const partner = db.users[pid];
    if (!partner) return null;
    
    const lastMsg = db.messages
      .filter(m => !m.is_deleted && ((String(m.sender_id) === uid && String(m.receiver_id) === pid) || (String(m.sender_id) === pid && String(m.receiver_id) === uid)))
      .pop();
    
    return { ...partner, lastMessage: lastMsg };
  }).filter(Boolean);

  res.json(conversations);
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
    if (!user || !user.id) return;
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
    const sId = String(senderId);
    const rId = String(receiverId);
    let updated = false;
    db.messages.forEach(m => {
      if (String(m.sender_id) === sId && String(m.receiver_id) === rId && m.status !== 'seen') {
        m.status = 'seen';
        updated = true;
      }
    });
    if (updated) {
      saveDB(db);
      io.to(sId).emit('status_update', { receiverId: rId, status: 'seen' });
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

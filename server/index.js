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
const initDB = () => { 
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify({ users: {}, messages: [] }, null, 2));
};
const getDB = () => { try { return JSON.parse(fs.readFileSync(DB_PATH)); } catch (e) { return { users: {}, messages: [] }; } };
const saveDB = (data) => fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
initDB();

// API
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
  if (db.users[userId]) { db.users[userId].avatar = avatar; saveDB(db); res.json(db.users[userId]); }
  else { res.status(404).json({ error: 'User not found' }); }
});

app.get('/api/messages/:userA/:userB', (req, res) => {
  const { userA, userB } = req.params;
  const db = getDB();
  const uA = String(userA); const uB = String(userB);
  res.json(db.messages.filter(m => !m.is_deleted && ((String(m.sender_id) === uA && String(m.receiver_id) === uB) || (String(m.sender_id) === uB && String(m.receiver_id) === uA))));
});

app.get('/api/conversations/:userId', (req, res) => {
  const { userId } = req.params;
  const uid = String(userId);
  const db = getDB();
  
  // Find all unique partners this user has ever messaged
  const chatPartners = new Set();
  db.messages.forEach(m => {
    const s = String(m.sender_id);
    const r = String(m.receiver_id);
    if (s === uid) chatPartners.add(r);
    else if (r === uid) chatPartners.add(s);
  });

  const conversations = Array.from(chatPartners).map(pid => {
    const partner = db.users[pid] || Object.values(db.users).find(u => String(u.id) === pid || String(u.phone) === pid);
    if (!partner) return null;
    const lastMsg = db.messages.filter(m => !m.is_deleted && ((String(m.sender_id) === uid && String(m.receiver_id) === pid) || (String(m.sender_id) === pid && String(m.receiver_id) === uid))).pop();
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
const socketMap = new Map(); // socket.id -> user
io.on('connection', (socket) => {
  socket.on('join', (user) => {
    if (!user || !user.id) return;
    const uid = String(user.id);
    socket.join(uid);
    socketMap.set(socket.id, { ...user, id: uid });
    
    // Deduplicate online users by ID
    const uniqueOnline = [];
    const seenIds = new Set();
    socketMap.forEach(u => {
      if (!seenIds.has(u.id)) {
        seenIds.add(u.id);
        uniqueOnline.push(u);
      }
    });
    io.emit('presence', uniqueOnline);
  });

  socket.on('send_message', (msg) => {
    const db = getDB();
    const newMsg = { ...msg, sender_id: String(msg.sender_id), receiver_id: String(msg.receiver_id), id: Date.now(), created_at: new Date().toISOString(), status: 'sent', is_deleted: false };
    db.messages.push(newMsg);
    saveDB(db);
    io.to(newMsg.receiver_id).emit('receive_message', newMsg);
    io.to(newMsg.sender_id).emit('receive_message', newMsg);
  });

  socket.on('mark_seen', ({ senderId, receiverId }) => {
    const db = getDB();
    const sId = String(senderId); const rId = String(receiverId);
    let updated = false;
    db.messages.forEach(m => { if (String(m.sender_id) === sId && String(m.receiver_id) === rId && m.status !== 'seen') { m.status = 'seen'; updated = true; } });
    if (updated) { saveDB(db); io.to(sId).emit('status_update', { receiverId: rId, status: 'seen' }); }
  });

  socket.on('disconnect', () => {
    socketMap.delete(socket.id);
    const uniqueOnline = [];
    const seenIds = new Set();
    socketMap.forEach(u => {
      if (!seenIds.has(u.id)) {
        seenIds.add(u.id);
        uniqueOnline.push(u);
      }
    });
    io.emit('presence', uniqueOnline);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server on ${PORT}`));

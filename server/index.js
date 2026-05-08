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
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ users: {}, messages: [] }, null, 2));
  } else {
    // Basic integrity check
    try {
      const data = JSON.parse(fs.readFileSync(DB_PATH));
      if (!data.messages) data.messages = [];
      if (!data.users) data.users = {};
      fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
      fs.writeFileSync(DB_PATH, JSON.stringify({ users: {}, messages: [] }, null, 2));
    }
  }
};

const getDB = () => {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH));
  } catch (e) {
    return { users: {}, messages: [] };
  }
};

const saveDB = (data) => {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('DB Save Error:', e);
  }
};

initDB();

// API
app.get('/api/user/:phone', (req, res) => res.json(getDB().users[req.params.phone] || {}));

app.post('/api/login', (req, res) => {
  const { phone, username } = req.body;
  const db = getDB();
  const phoneStr = String(phone);
  if (!db.users[phoneStr]) {
    db.users[phoneStr] = { 
      id: phoneStr, 
      phone: phoneStr, 
      username: username || phoneStr, 
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username || phoneStr}`, 
      joinedAt: new Date().toISOString() 
    };
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
  const thread = db.messages.filter(m => 
    !m.is_deleted && (
      (String(m.sender_id) === uA && String(m.receiver_id) === uB) || 
      (String(m.sender_id) === uB && String(m.receiver_id) === uA)
    )
  );
  res.json(thread);
});

app.get('/api/conversations/:userId', (req, res) => {
  const { userId } = req.params;
  const uid = String(userId);
  const db = getDB();
  
  console.log(`[Conversations] Request for UserID: ${uid}`);
  console.log(`[Conversations] Total messages in DB: ${db.messages.length}`);

  const chatPartners = new Set();
  db.messages.forEach(m => {
    const s = String(m.sender_id);
    const r = String(m.receiver_id);
    if (s === uid) chatPartners.add(r);
    if (r === uid) chatPartners.add(s);
  });

  console.log(`[Conversations] Found partners:`, Array.from(chatPartners));

  const conversations = Array.from(chatPartners).map(pid => {
    // Try to find user by ID or by matching ID in values
    let partner = db.users[pid];
    if (!partner) {
      partner = Object.values(db.users).find(u => String(u.id) === pid);
    }
    
    if (!partner) {
      console.log(`[Conversations] Partner ${pid} not found in db.users`);
      return null;
    }
    
    const lastMsg = db.messages
      .filter(m => !m.is_deleted && (
        (String(m.sender_id) === uid && String(m.receiver_id) === pid) || 
        (String(m.sender_id) === pid && String(m.receiver_id) === uid)
      ))
      .pop();
    
    return { ...partner, lastMessage: lastMsg };
  }).filter(Boolean);

  console.log(`[Conversations] Returning ${conversations.length} conversations`);
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
  console.log(`[Socket] New connection: ${socket.id}`);

  socket.on('join', (user) => {
    if (!user || !user.id) return;
    const uid = String(user.id);
    socket.join(uid);
    onlineUsers.set(socket.id, { ...user, id: uid });
    console.log(`[Socket] User ${uid} joined room`);
    io.emit('presence', Array.from(onlineUsers.values()));
  });

  socket.on('send_message', (msg) => {
    const db = getDB();
    const newMsg = { 
      ...msg, 
      sender_id: String(msg.sender_id),
      receiver_id: String(msg.receiver_id),
      id: Date.now(), 
      created_at: new Date().toISOString(), 
      status: 'sent', 
      is_deleted: false 
    };
    db.messages.push(newMsg);
    saveDB(db);
    console.log(`[Socket] Message saved: ${newMsg.sender_id} -> ${newMsg.receiver_id}`);
    io.to(newMsg.receiver_id).emit('receive_message', newMsg);
    io.to(newMsg.sender_id).emit('receive_message', newMsg);
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
    if (u) { 
      console.log(`[Socket] User ${u.id} disconnected`);
      onlineUsers.delete(socket.id); 
      io.emit('presence', Array.from(onlineUsers.values())); 
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server on ${PORT}`));

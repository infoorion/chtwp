import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { Search, LogOut, MessageSquare, User, Camera, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { socket, apiFetch } from '../utils/socketClient';

const ChatList = () => {
  const { user, logout, setUser } = useAuth();
  const navigate = useNavigate();
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [recentChats, setRecentChats] = useState([]);
  const [showProfile, setShowProfile] = useState(false);
  const [newAvatar, setNewAvatar] = useState('');

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        const chats = await apiFetch(`/conversations/${user.id}`);
        setRecentChats(chats);
      } catch (err) { console.error(err); }
    };
    fetchData();
    socket.emit('join', user);
    socket.on('presence', (users) => setOnlineUsers(users.filter(u => String(u.id) !== String(user.id))));
    socket.on('receive_message', fetchData);
    return () => { socket.off('presence'); socket.off('receive_message'); };
  }, [user]);

  const handleUpdateAvatar = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = async () => {
      const data = await apiFetch('/update-profile', {
        method: 'POST',
        body: JSON.stringify({ userId: user.id, avatar: r.result })
      });
      if (data.id) {
        setUser(data);
        localStorage.setItem('sgram_user', JSON.stringify(data));
        setShowProfile(false);
      }
    };
    r.readAsDataURL(file);
  };

  const isOnline = (userId) => onlineUsers.some(u => String(u.id) === String(userId));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="chats-screen-v2">
      <header className="chats-header-v2">
        <div className="header-left-v2" onClick={() => setShowProfile(true)}>
          <img src={user?.avatar} className="mini-avatar" alt="" />
          <h1 className="brand-logo-v2">sgram</h1>
        </div>
        <button className="logout-btn-v2" onClick={logout}><LogOut size={20} /></button>
      </header>

      <div className="search-bar-v2">
        <div className="search-input-v2">
          <Search size={18} />
          <input placeholder="Search chats..." />
        </div>
      </div>

      <div className="chat-list-v2">
        {recentChats.map((chat) => (
          <div key={chat.id} className="chat-row-v2" onClick={() => navigate(`/chat/${chat.id}`)}>
            <div className="avatar-box">
              <img src={chat.avatar} alt="" />
              {isOnline(chat.id) && <div className="online-dot" />}
            </div>
            <div className="chat-info">
              <div className="chat-row-header">
                <h3>{chat.username}</h3>
                <span>{chat.lastMessage ? new Date(chat.lastMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
              </div>
              <p>{chat.lastMessage?.text || 'Tap to chat'}</p>
            </div>
            {chat.lastMessage?.sender_id === chat.id && chat.lastMessage?.status !== 'seen' && (
              <div className="unread-dot" />
            )}
          </div>
        ))}
      </div>

      <AnimatePresence>
        {showProfile && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="profile-modal">
              <div className="modal-header">
                <h2>Edit Profile</h2>
                <button onClick={() => setShowProfile(false)}><X /></button>
              </div>
              <div className="avatar-edit">
                <div className="big-avatar">
                  <img src={user?.avatar} alt="" />
                  <label className="camera-btn">
                    <Camera size={24} />
                    <input type="file" hidden onChange={handleUpdateAvatar} />
                  </label>
                </div>
                <h3>{user?.username}</h3>
                <p>{user?.phone}</p>
              </div>
              <button className="done-btn" onClick={() => setShowProfile(false)}>Done</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .chats-screen-v2 { height: 100vh; display: flex; flex-direction: column; background: #000; color: white; max-width: 500px; margin: 0 auto; }
        .chats-header-v2 { display: flex; justify-content: space-between; align-items: center; padding: 16px; }
        .header-left-v2 { display: flex; align-items: center; gap: 12px; cursor: pointer; }
        .mini-avatar { width: 32px; height: 32px; border-radius: 50%; border: 1px solid #262626; }
        .brand-logo-v2 { font-size: 24px; font-weight: 800; background: var(--gradient-insta); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .search-bar-v2 { padding: 8px 16px; }
        .search-input-v2 { background: #121212; border-radius: 12px; display: flex; align-items: center; padding: 10px 16px; gap: 12px; color: #8e8e8e; }
        .search-input-v2 input { background: transparent; border: none; color: white; flex: 1; outline: none; }
        .chat-list-v2 { flex: 1; overflow-y: auto; padding-top: 10px; }
        .chat-row-v2 { display: flex; align-items: center; gap: 12px; padding: 12px 16px; cursor: pointer; }
        .avatar-box { position: relative; width: 60px; height: 60px; }
        .avatar-box img { width: 100%; height: 100%; border-radius: 50%; }
        .online-dot { position: absolute; bottom: 2px; right: 2px; width: 14px; height: 14px; background: #4caf50; border: 2px solid #000; border-radius: 50%; }
        .chat-info { flex: 1; border-bottom: 0.5px solid #1a1a1a; padding-bottom: 12px; }
        .chat-row-header { display: flex; justify-content: space-between; margin-bottom: 4px; }
        .chat-row-header h3 { font-size: 15px; font-weight: 700; }
        .chat-row-header span { font-size: 12px; color: #8e8e8e; }
        .chat-info p { font-size: 13px; color: #8e8e8e; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px; }
        .unread-dot { width: 8px; height: 8px; background: var(--accent); border-radius: 50%; margin-left: 10px; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .profile-modal { background: #121212; width: 100%; max-width: 400px; border-radius: 24px; padding: 24px; border: 1px solid #262626; }
        .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .avatar-edit { display: flex; flex-direction: column; align-items: center; gap: 16px; margin-bottom: 30px; }
        .big-avatar { position: relative; width: 120px; height: 120px; }
        .big-avatar img { width: 100%; height: 100%; border-radius: 50%; border: 2px solid var(--accent); }
        .camera-btn { position: absolute; bottom: 0; right: 0; background: var(--accent); padding: 10px; border-radius: 50%; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
        .done-btn { width: 100%; background: #fff; color: #000; padding: 14px; border-radius: 12px; font-weight: 700; }
      `}</style>
    </motion.div>
  );
};

export default ChatList;

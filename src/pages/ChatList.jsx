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
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const chats = await apiFetch(`/conversations/${user.id}`);
      setRecentChats(chats);
      setLoading(false);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (!user) return;
    fetchData();
    socket.emit('join', user);
    
    socket.on('presence', (users) => {
      console.log('[Presence] Updating:', users);
      const others = users.filter(u => String(u.id) !== String(user.id));
      setOnlineUsers(others);
    });

    socket.on('receive_message', fetchData);

    return () => {
      socket.off('presence');
      socket.off('receive_message');
    };
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="chats-screen-v3">
      <header className="chats-header-v3">
        <div className="header-left-v3" onClick={() => setShowProfile(true)}>
          <div className="user-avatar-ring">
            <img src={user?.avatar} alt="Me" />
          </div>
          <h1 className="brand-logo-v3">sgram</h1>
        </div>
        <button className="logout-btn-v3" onClick={logout}><LogOut size={20} /></button>
      </header>

      <div className="search-section">
        <div className="search-input-v3">
          <Search size={18} />
          <input placeholder="Search chats..." />
        </div>
      </div>

      {/* Online Now - Horizontal Scroll */}
      <div className="online-now-v3">
        <h3 className="section-title-v3">Online Now</h3>
        <div className="online-scroll-v3">
          <div className="online-user-v3 me">
            <div className="avatar-circle">
              <img src={user?.avatar} alt="" />
              <div className="status-indicator active" />
            </div>
            <span>You</span>
          </div>
          <AnimatePresence>
            {onlineUsers.map(u => (
              <motion.div 
                key={u.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="online-user-v3"
                onClick={() => navigate(`/chat/${u.id}`)}
              >
                <div className="avatar-circle pulse">
                  <img src={u.avatar} alt="" />
                  <div className="status-indicator active" />
                </div>
                <span>{u.username}</span>
              </motion.div>
            ))}
          </AnimatePresence>
          {onlineUsers.length === 0 && (
            <p className="no-online-text">No friends online</p>
          )}
        </div>
      </div>

      <div className="recent-chats-v3">
        <h3 className="section-title-v3">Recent Messages</h3>
        <div className="chat-list-v3">
          {recentChats.length === 0 && !loading ? (
            <div className="empty-chats">
              <MessageSquare size={48} opacity={0.2} />
              <p>Your recent conversations will appear here.</p>
            </div>
          ) : (
            recentChats.map((chat) => (
              <div key={chat.id} className="chat-row-v3" onClick={() => navigate(`/chat/${chat.id}`)}>
                <div className="avatar-main">
                  <img src={chat.avatar} alt="" />
                  {isOnline(chat.id) && <div className="online-dot-v3" />}
                </div>
                <div className="chat-text">
                  <div className="chat-row-top-v3">
                    <h3>{chat.username}</h3>
                    <span>{chat.lastMessage ? new Date(chat.lastMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  </div>
                  <p>{chat.lastMessage?.text || 'Tap to chat'}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Profile Modal */}
      <AnimatePresence>
        {showProfile && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay">
            <motion.div initial={{ y: 50 }} animate={{ y: 0 }} className="profile-modal-v3">
              <div className="modal-top">
                <h2>Settings</h2>
                <button onClick={() => setShowProfile(false)}><X /></button>
              </div>
              <div className="profile-edit-box">
                <div className="profile-avatar-large">
                  <img src={user?.avatar} alt="" />
                  <label className="edit-btn"><Camera size={20} /><input type="file" hidden onChange={handleUpdateAvatar} /></label>
                </div>
                <div className="user-details-v3">
                  <h3>{user?.username}</h3>
                  <p>{user?.phone}</p>
                </div>
              </div>
              <button className="close-modal-btn" onClick={() => setShowProfile(false)}>Close</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .chats-screen-v3 { height: 100vh; display: flex; flex-direction: column; background: #000; color: white; max-width: 500px; margin: 0 auto; overflow: hidden; }
        .chats-header-v3 { display: flex; justify-content: space-between; align-items: center; padding: 20px 16px; }
        .header-left-v3 { display: flex; align-items: center; gap: 12px; cursor: pointer; }
        .user-avatar-ring { width: 34px; height: 34px; border-radius: 50%; padding: 2px; background: var(--gradient-insta); }
        .user-avatar-ring img { width: 100%; height: 100%; border-radius: 50%; border: 1px solid #000; }
        .brand-logo-v3 { font-size: 26px; font-weight: 800; background: var(--gradient-insta); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-family: 'Outfit', sans-serif; }
        .logout-btn-v3 { color: #ed4956; padding: 8px; border-radius: 50%; background: #1a1a1a; }
        .search-section { padding: 0 16px 16px; }
        .search-input-v3 { background: #121212; border-radius: 12px; display: flex; align-items: center; padding: 12px 16px; gap: 12px; color: #8e8e8e; border: 1px solid #1a1a1a; }
        .search-input-v3 input { background: transparent; border: none; color: white; flex: 1; outline: none; font-size: 14px; }
        .section-title-v3 { font-size: 13px; font-weight: 700; color: #8e8e8e; text-transform: uppercase; letter-spacing: 0.5px; padding: 0 16px 12px; }
        .online-now-v3 { padding-bottom: 20px; border-bottom: 1px solid #1a1a1a; }
        .online-scroll-v3 { display: flex; gap: 18px; padding: 0 16px; overflow-x: auto; scrollbar-width: none; align-items: center; }
        .online-user-v3 { display: flex; flex-direction: column; align-items: center; gap: 8px; flex-shrink: 0; cursor: pointer; }
        .avatar-circle { width: 62px; height: 62px; position: relative; border-radius: 50%; padding: 3px; border: 2px solid #262626; }
        .avatar-circle.pulse { border-color: var(--accent); }
        .avatar-circle img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
        .status-indicator { position: absolute; bottom: 3px; right: 3px; width: 14px; height: 14px; border-radius: 50%; border: 2px solid #000; background: #8e8e8e; }
        .status-indicator.active { background: #4caf50; box-shadow: 0 0 8px #4caf50; }
        .online-user-v3 span { font-size: 11px; font-weight: 500; color: #a8a8a8; }
        .no-online-text { font-size: 12px; color: #333; padding-left: 10px; }
        .recent-chats-v3 { flex: 1; padding-top: 20px; display: flex; flex-direction: column; }
        .chat-list-v3 { flex: 1; overflow-y: auto; }
        .chat-row-v3 { display: flex; align-items: center; gap: 14px; padding: 14px 16px; transition: background 0.2s; cursor: pointer; }
        .chat-row-v3:active { background: #0a0a0a; }
        .avatar-main { position: relative; width: 56px; height: 56px; }
        .avatar-main img { width: 100%; height: 100%; border-radius: 50%; }
        .online-dot-v3 { position: absolute; bottom: 2px; right: 2px; width: 14px; height: 14px; background: #4caf50; border: 2px solid #000; border-radius: 50%; }
        .chat-text { flex: 1; border-bottom: 0.5px solid #1a1a1a; padding-bottom: 14px; }
        .chat-row-top-v3 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
        .chat-row-top-v3 h3 { font-size: 15px; font-weight: 700; color: #efefef; }
        .chat-row-top-v3 span { font-size: 12px; color: #8e8e8e; }
        .chat-text p { font-size: 13px; color: #8e8e8e; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 260px; }
        .empty-chats { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #444; text-align: center; padding: 40px; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .profile-modal-v3 { background: #121212; width: 100%; max-width: 400px; border-radius: 30px; padding: 30px; border: 1px solid #262626; }
        .modal-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
        .profile-edit-box { display: flex; flex-direction: column; align-items: center; gap: 20px; margin-bottom: 40px; }
        .profile-avatar-large { position: relative; width: 110px; height: 110px; }
        .profile-avatar-large img { width: 100%; height: 100%; border-radius: 50%; border: 2px solid var(--accent); }
        .edit-btn { position: absolute; bottom: 0; right: 0; background: var(--accent); padding: 8px; border-radius: 50%; cursor: pointer; }
        .user-details-v3 { text-align: center; }
        .user-details-v3 h3 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
        .user-details-v3 p { color: #8e8e8e; }
        .close-modal-btn { width: 100%; background: #262626; color: #fff; padding: 16px; border-radius: 16px; font-weight: 700; }
      `}</style>
    </motion.div>
  );
};

export default ChatList;

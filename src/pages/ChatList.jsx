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
    } catch (err) { console.error('[API] Fetch error:', err); }
  };

  useEffect(() => {
    if (!user) return;
    fetchData();
    socket.emit('join', user);
    
    socket.on('presence', (users) => {
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
    const file = e.target.files?.[0];
    if (!file) return;
    
    console.log('[Profile] File selected:', file.name);
    
    const reader = new FileReader();
    reader.onloadstart = () => console.log('[Profile] Reading file...');
    reader.onloadend = async () => {
      const base64 = reader.result;
      console.log('[Profile] File read complete. Uploading to server...');
      
      try {
        const response = await apiFetch('/update-profile', {
          method: 'POST',
          body: JSON.stringify({ userId: String(user.id), avatar: base64 })
        });
        
        if (response && response.id) {
          console.log('[Profile] Update success!');
          setUser(response);
          localStorage.setItem('sgram_user', JSON.stringify(response));
          setShowProfile(false);
          // Force a small delay then refresh UI data
          setTimeout(fetchData, 500);
        } else {
          console.error('[Profile] Server returned error:', response);
          alert('Error: ' + (response?.error || 'Unknown error'));
        }
      } catch (err) {
        console.error('[Profile] Network error:', err);
        alert('Could not connect to server to update photo.');
      }
    };
    reader.onerror = (err) => console.error('[Profile] FileReader error:', err);
    reader.readAsDataURL(file);
  };

  const isOnline = (userId) => onlineUsers.some(u => String(u.id) === String(userId));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-home-screen">
      <header className="p-home-header">
        <div className="p-user-profile" onClick={() => setShowProfile(true)}>
          <div className="p-avatar-border">
            <img src={user?.avatar} alt="Profile" />
          </div>
          <div className="p-brand">
            <h1>sgram</h1>
            <span>{user?.username}</span>
          </div>
        </div>
        <button className="p-logout" onClick={logout}><LogOut size={22} /></button>
      </header>

      <div className="p-search-container">
        <div className="p-search-box">
          <Search size={18} />
          <input placeholder="Search friends & chats..." />
        </div>
      </div>

      <div className="p-online-section">
        <h3 className="p-section-title">Online Now</h3>
        <div className="p-online-list">
          <div className="p-online-card me">
            <div className="p-avatar-lg">
              <img src={user?.avatar} alt="" />
              <div className="p-online-dot active" />
            </div>
            <span>You</span>
          </div>
          <AnimatePresence>
            {onlineUsers.map(u => (
              <motion.div 
                key={u.id}
                initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                className="p-online-card"
                onClick={() => navigate(`/chat/${u.id}`)}
              >
                <div className="p-avatar-lg glow">
                  <img src={u.avatar} alt="" />
                  <div className="p-online-dot active" />
                </div>
                <span>{u.username}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <div className="p-chats-section">
        <h3 className="p-section-title">Recent Chats</h3>
        <div className="p-chat-scroll">
          {recentChats.length === 0 && !loading ? (
            <div className="p-empty-chats">
              <MessageSquare size={48} opacity={0.1} />
              <p>Your inbox is empty</p>
            </div>
          ) : (
            recentChats.map((chat) => (
              <div key={chat.id} className="p-chat-item" onClick={() => navigate(`/chat/${chat.id}`)}>
                <div className="p-avatar-md">
                  <img src={chat.avatar} alt="" />
                  {isOnline(chat.id) && <div className="p-dot-mini" />}
                </div>
                <div className="p-chat-info">
                  <div className="p-chat-top">
                    <h3>{chat.username}</h3>
                    <span>{chat.lastMessage ? new Date(chat.lastMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  </div>
                  <p>{chat.lastMessage?.text || 'Sent a media file'}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Profile Modal */}
      <AnimatePresence>
        {showProfile && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-modal-overlay">
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="p-profile-modal">
              <div className="p-modal-head">
                <h2>Profile Settings</h2>
                <button onClick={() => setShowProfile(false)}><X /></button>
              </div>
              <div className="p-profile-edit">
                <div className="p-avatar-huge">
                  <img src={user?.avatar} alt="Current Profile" />
                  {/* Fixed Label/Input Connection */}
                  <label htmlFor="profile-upload" className="p-cam-btn">
                    <Camera size={26} />
                  </label>
                  <input 
                    id="profile-upload"
                    type="file" 
                    accept="image/*" 
                    hidden 
                    onChange={handleUpdateAvatar} 
                  />
                </div>
                <div className="p-user-meta">
                  <h3>{user?.username}</h3>
                  <p>{user?.phone}</p>
                </div>
              </div>
              <button className="p-save-btn" onClick={() => setShowProfile(false)}>Close</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .p-home-screen { height: 100vh; display: flex; flex-direction: column; background: #09090b; color: white; max-width: 500px; margin: 0 auto; overflow: hidden; position: relative; }
        .p-home-header { display: flex; justify-content: space-between; align-items: center; padding: 24px 16px; background: rgba(9,9,11,0.5); backdrop-filter: blur(10px); }
        .p-user-profile { display: flex; align-items: center; gap: 14px; cursor: pointer; }
        .p-avatar-border { width: 44px; height: 44px; border-radius: 50%; padding: 2px; background: var(--gradient-premium); }
        .p-avatar-border img { width: 100%; height: 100%; border-radius: 50%; border: 2px solid #000; }
        .p-brand h1 { font-size: 24px; font-weight: 800; background: var(--gradient-premium); -webkit-background-clip: text; -webkit-text-fill-color: transparent; line-height: 1; }
        .p-brand span { font-size: 12px; color: #71717a; font-weight: 600; }
        .p-logout { color: #ed4956; padding: 10px; border-radius: 12px; background: rgba(237,73,86,0.1); }
        .p-search-container { padding: 0 16px 24px; }
        .p-search-box { background: #18181b; border-radius: 16px; display: flex; align-items: center; padding: 14px 20px; gap: 14px; border: 1px solid rgba(255,255,255,0.05); color: #71717a; }
        .p-search-box input { background: transparent; border: none; color: white; flex: 1; outline: none; font-size: 15px; }
        .p-section-title { font-size: 13px; font-weight: 800; color: #71717a; text-transform: uppercase; letter-spacing: 1px; padding: 0 16px 16px; }
        .p-online-section { padding-bottom: 24px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .p-online-list { display: flex; gap: 20px; padding: 0 16px; overflow-x: auto; scrollbar-width: none; }
        .p-online-card { display: flex; flex-direction: column; align-items: center; gap: 10px; flex-shrink: 0; cursor: pointer; }
        .p-avatar-lg { width: 68px; height: 68px; position: relative; border-radius: 50%; padding: 3px; border: 2px solid #27272a; transition: transform 0.2s; }
        .p-avatar-lg.glow { border-color: #00d2ff; box-shadow: 0 0 15px rgba(0,210,255,0.2); }
        .p-avatar-lg img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
        .p-online-dot { position: absolute; bottom: 4px; right: 4px; width: 14px; height: 14px; border-radius: 50%; border: 3px solid #000; background: #4caf50; }
        .p-online-card span { font-size: 12px; color: #a1a1aa; font-weight: 500; }
        .p-chats-section { flex: 1; padding-top: 24px; display: flex; flex-direction: column; }
        .p-chat-scroll { flex: 1; overflow-y: auto; }
        .p-chat-item { display: flex; align-items: center; gap: 16px; padding: 16px; transition: background 0.2s; cursor: pointer; }
        .p-avatar-md { position: relative; width: 60px; height: 60px; }
        .p-avatar-md img { width: 100%; height: 100%; border-radius: 50%; }
        .p-dot-mini { position: absolute; bottom: 2px; right: 2px; width: 14px; height: 14px; background: #4caf50; border: 3px solid #000; border-radius: 50%; }
        .p-chat-info { flex: 1; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 16px; }
        .p-chat-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
        .p-chat-top h3 { font-size: 16px; font-weight: 700; color: #f4f4f5; }
        .p-chat-top span { font-size: 12px; color: #71717a; }
        .p-chat-info p { font-size: 14px; color: #71717a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 260px; }
        .p-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.95); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .p-profile-modal { background: #18181b; width: 100%; max-width: 420px; border-radius: 32px; padding: 32px; border: 1px solid rgba(255,255,255,0.1); }
        .p-modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
        .p-modal-head h2 { font-size: 22px; font-weight: 800; }
        .p-profile-edit { display: flex; flex-direction: column; align-items: center; gap: 24px; margin-bottom: 40px; }
        .p-avatar-huge { position: relative; width: 130px; height: 130px; }
        .p-avatar-huge img { width: 100%; height: 100%; border-radius: 50%; border: 3px solid #00d2ff; box-shadow: 0 0 30px rgba(0,210,255,0.2); }
        .p-cam-btn { position: absolute; bottom: 0; right: 0; background: #00d2ff; padding: 12px; border-radius: 50%; cursor: pointer; color: #fff; box-shadow: 0 4px 15px rgba(0,0,0,0.4); }
        .p-user-meta { text-align: center; }
        .p-user-meta h3 { font-size: 24px; font-weight: 800; margin-bottom: 6px; }
        .p-user-meta p { color: #71717a; font-size: 15px; }
        .p-save-btn { width: 100%; background: #fff; color: #000; padding: 18px; border-radius: 20px; font-weight: 800; font-size: 16px; }
      `}</style>
    </motion.div>
  );
};

export default ChatList;

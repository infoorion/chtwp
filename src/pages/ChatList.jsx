import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { Search, Edit, LogOut, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { socket, apiFetch } from '../utils/socketClient';

const ChatList = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [recentChats, setRecentChats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const chats = await apiFetch(`/conversations/${user.id}`);
        setRecentChats(chats);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching conversations:', err);
      }
    };

    fetchData();

    const onPresence = (users) => {
      console.log('[Presence] Online users update:', users);
      const others = users.filter(u => String(u.id) !== String(user.id));
      setOnlineUsers(others);
    };

    const onMessage = () => {
      console.log('[Socket] New message received, refreshing list');
      fetchData();
    };

    socket.on('presence', onPresence);
    socket.on('receive_message', onMessage);

    // Initial request for presence if already connected
    if (socket.connected) {
      socket.emit('get_presence');
    }

    return () => {
      socket.off('presence', onPresence);
      socket.off('receive_message', onMessage);
    };
  }, [user]);

  const isOnline = (userId) => onlineUsers.some(u => String(u.id) === String(userId));

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="chats-screen"
    >
      <header className="chats-header">
        <div className="header-left">
          <h1 className="brand-logo">sgram</h1>
        </div>
        <div className="header-right">
          <button className="logout-btn" onClick={logout}>
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      <div className="search-bar">
        <div className="search-input">
          <Search size={16} className="search-icon" />
          <input type="text" placeholder="Search chats..." />
        </div>
      </div>

      <div className="online-now-section">
        <h3 className="section-title">Online Now</h3>
        <div className="online-users-scroll">
          <div className="online-user-item me">
            <div className="avatar-ring">
              <img src={user?.avatar} alt="Me" />
              <div className="online-indicator" />
            </div>
            <span className="user-label">You</span>
          </div>
          <AnimatePresence>
            {onlineUsers.map(u => (
              <motion.div 
                key={u.id} 
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="online-user-item"
                onClick={() => navigate(`/chat/${u.id}`)}
              >
                <div className="avatar-ring">
                  <img src={u.avatar} alt={u.username} />
                  <div className="online-indicator" />
                </div>
                <span className="user-label">{u.username}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <div className="messages-section">
        <div className="section-header">
          <h3>Recent Messages</h3>
        </div>

        <div className="chat-list">
          {recentChats.length === 0 && !loading ? (
            <div className="empty-state">
              <div className="empty-icon-bg">
                <MessageSquare size={32} />
              </div>
              <h4>No chats yet</h4>
              <p>Start a conversation with an online friend!</p>
            </div>
          ) : (
            recentChats.map((chat) => (
              <div 
                key={chat.id} 
                className="chat-row"
                onClick={() => navigate(`/chat/${chat.id}`)}
              >
                <div className="chat-avatar">
                  <img src={chat.avatar} alt={chat.username} />
                  {isOnline(chat.id) && <div className="status-dot" />}
                </div>
                <div className="chat-details">
                  <div className="chat-row-top">
                    <span className="chat-row-name">{chat.username}</span>
                    <span className="chat-row-time">
                      {chat.lastMessage ? new Date(chat.lastMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <p className="chat-row-msg">
                    {chat.lastMessage?.type === 'text' ? chat.lastMessage.text : 
                     chat.lastMessage?.type ? `Sent a ${chat.lastMessage.type}` : 'Tap to chat'}
                  </p>
                </div>
                {!isOnline(chat.id) && <span className="offline-badge">Offline</span>}
              </div>
            ))
          )}
        </div>
      </div>

      <style>{`
        .chats-screen { height: 100vh; display: flex; flex-direction: column; background: #000; color: white; max-width: 500px; margin: 0 auto; }
        .chats-header { display: flex; justify-content: space-between; align-items: center; padding: 16px; }
        .brand-logo { font-family: 'Outfit', sans-serif; font-size: 28px; font-weight: 800; background: var(--gradient-insta); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .logout-btn { display: flex; align-items: center; gap: 6px; background: #1a1a1a; color: #ed4956; padding: 6px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; }
        .section-title { font-size: 13px; color: #8e8e8e; text-transform: uppercase; letter-spacing: 1px; padding: 0 16px 12px; font-weight: 600; }
        .online-now-section { padding: 16px 0; border-bottom: 1px solid #262626; }
        .online-users-scroll { display: flex; gap: 16px; padding: 0 16px; overflow-x: auto; scrollbar-width: none; }
        .online-user-item { display: flex; flex-direction: column; align-items: center; gap: 6px; flex-shrink: 0; cursor: pointer; }
        .avatar-ring { width: 64px; height: 64px; border-radius: 50%; padding: 2px; background: var(--gradient-insta); position: relative; }
        .avatar-ring img { width: 100%; height: 100%; border-radius: 50%; border: 2px solid #000; object-fit: cover; }
        .online-indicator { position: absolute; bottom: 4px; right: 4px; width: 12px; height: 12px; background: #4caf50; border: 2px solid #000; border-radius: 50%; }
        .user-label { font-size: 11px; color: #a8a8a8; }
        .messages-section { flex: 1; padding-top: 20px; }
        .section-header { padding: 0 16px 16px; }
        .chat-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; position: relative; cursor: pointer; }
        .chat-avatar { position: relative; width: 56px; height: 56px; }
        .chat-avatar img { width: 100%; height: 100%; border-radius: 50%; }
        .status-dot { position: absolute; bottom: 2px; right: 2px; width: 14px; height: 14px; background: #4caf50; border: 2px solid #000; border-radius: 50%; }
        .chat-row-name { font-weight: 600; font-size: 15px; }
        .chat-row-time { font-size: 12px; color: #8e8e8e; }
        .chat-row-msg { font-size: 13px; color: #8e8e8e; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
        .offline-badge { font-size: 10px; background: #1a1a1a; color: #8e8e8e; padding: 2px 6px; border-radius: 4px; margin-left: auto; }
        .empty-state { display: flex; flex-direction: column; align-items: center; padding: 60px 20px; text-align: center; color: #8e8e8e; }
        .empty-icon-bg { width: 64px; height: 64px; border-radius: 50%; border: 1px solid #262626; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; }
      `}</style>
    </motion.div>
  );
};

export default ChatList;

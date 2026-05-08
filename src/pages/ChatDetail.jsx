import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { socket, apiFetch } from '../utils/socketClient';
import { ChevronLeft, Info, Send, Image as ImageIcon, Smile, MoreHorizontal, X, Search } from 'lucide-react';

const ChatDetail = () => {
  const { id } = useParams(); // receiver_id
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGifs, setShowGifs] = useState(false);
  const [gifSearch, setGifSearch] = useState('');
  const [gifResults, setGifResults] = useState([]);
  const scrollRef = useRef();

  // Mock Stickers
  const stickers = [
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHYybmM0NXN6OXN6OXN6OXN6OXN6OXN6OXN6OXN6OXN6OXN6OXN6JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1z/3o7TKVUn7iM8FMEU24/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHYybmM0NXN6OXN6OXN6OXN6OXN6OXN6OXN6OXN6OXN6OXN6OXN6JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1z/l41lTfuxV5F6T/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHYybmM0NXN6OXN6OXN6OXN6OXN6OXN6OXN6OXN6OXN6OXN6OXN6JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1z/3o7TKMGBlK8M6O/giphy.gif'
  ];

  // Fetch History
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await apiFetch(`/messages/${user.id}/${id}`);
        setMessages(data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching history:', err);
      }
    };
    fetchHistory();
  }, [id, user.id]);

  // Real-time Listeners
  useEffect(() => {
    console.log('[Socket] Setting up listener for receive_message');
    
    const onMessage = (msg) => {
      console.log('[Socket] Message received:', msg);
      // Ensure strict string comparison for IDs
      const isRelevant = 
        (String(msg.sender_id) === String(user.id) && String(msg.receiver_id) === String(id)) || 
        (String(msg.sender_id) === String(id) && String(msg.receiver_id) === String(user.id));
      
      if (isRelevant) {
        console.log('[UI] Adding message to state');
        setMessages(prev => {
          // Prevent duplicates
          if (prev.find(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    };

    socket.on('receive_message', onMessage);

    return () => {
      console.log('[Socket] Cleaning up listener');
      socket.off('receive_message', onMessage);
    };
  }, [id, user.id]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (content, type = 'text') => {
    if (type === 'text' && !content.trim()) return;

    const msgData = {
      sender_id: String(user.id),
      receiver_id: String(id),
      text: type === 'text' ? content : '',
      media_url: type !== 'text' ? content : null,
      type: type,
      sender_name: user.username,
      sender_avatar: user.avatar
    };

    console.log('[Socket] Emitting send_message:', msgData);
    socket.emit('send_message', msgData);
    if (type === 'text') setNewMessage('');
    setShowEmoji(false);
    setShowGifs(false);
  };

  const searchGifs = async () => {
    if (!gifSearch) return;
    // Using a public proxy for Tenor/Giphy or just mock for demo
    setGifResults([
      'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHYybmM0NXN6OXN6OXN6OXN6OXN6OXN6OXN6OXN6OXN6OXN6OXN6JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/cuPm4A4pUR9Ao/giphy.gif',
      'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHYybmM0NXN6OXN6OXN6OXN6OXN6OXN6OXN6OXN6OXN6OXN6OXN6JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/5GovlCZycMqd2/giphy.gif',
      'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHYybmM0NXN6OXN6OXN6OXN6OXN6OXN6OXN6OXN6OXN6OXN6OXN6JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/9rZaX73iK75S0/giphy.gif'
    ]);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleSendMessage(reader.result, 'image');
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="chat-detail-screen">
      <header className="chat-header">
        <button onClick={() => navigate('/chats')} className="icon-btn">
          <ChevronLeft size={24} />
        </button>
        <div className="header-user">
          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`} alt="User" />
          <div className="user-info">
            <h3>{id}</h3>
            <span className="online-tag">Online</span>
          </div>
        </div>
        <div className="header-actions">
          <button className="icon-btn"><Info size={20} /></button>
        </div>
      </header>

      <div className="messages-container">
        {loading ? (
          <div className="loading-chat">Loading conversation...</div>
        ) : (
          <div className="messages-list">
            {messages.map((msg, idx) => (
              <motion.div 
                key={msg.id || idx}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`message-bubble ${msg.sender_id === String(user.id) ? 'sent' : 'received'}`}
              >
                <div className="bubble-content">
                  {msg.type === 'image' || msg.type === 'gif' || msg.type === 'sticker' ? (
                    <img src={msg.media_url} alt="media" className="msg-media" />
                  ) : (
                    msg.text
                  )}
                </div>
                <span className="message-time">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </motion.div>
            ))}
            <div ref={scrollRef} />
          </div>
        )}
      </div>

      <AnimatePresence>
        {showGifs && (
          <motion.div 
            initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }}
            className="media-picker"
          >
            <div className="picker-header">
              <div className="search-box">
                <Search size={16} />
                <input 
                  type="text" placeholder="Search GIFs..." 
                  value={gifSearch} onChange={e => setGifSearch(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && searchGifs()}
                />
              </div>
              <button onClick={() => setShowGifs(false)}><X size={20}/></button>
            </div>
            <div className="gif-grid">
              {(gifResults.length > 0 ? gifResults : stickers).map((url, i) => (
                <img key={i} src={url} onClick={() => handleSendMessage(url, gifResults.length > 0 ? 'gif' : 'sticker')} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="input-outer">
        <form className="message-input-area" onSubmit={(e) => { e.preventDefault(); handleSendMessage(newMessage); }}>
          <button type="button" className="icon-btn" onClick={() => { setShowGifs(!showGifs); setGifResults([]); }}>
            <Smile size={24} color={showGifs ? 'var(--accent)' : 'white'} />
          </button>
          <div className="input-wrapper">
            <input 
              type="text" 
              placeholder="Message..." 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onFocus={() => { setShowEmoji(false); setShowGifs(false); }}
            />
            <label className="icon-btn media-upload">
              <ImageIcon size={20} />
              <input type="file" accept="image/*" onChange={handleImageUpload} hidden />
            </label>
          </div>
          {newMessage.trim() ? (
            <button type="submit" className="send-btn">Send</button>
          ) : (
            <button type="button" className="icon-btn"><MoreHorizontal size={24} /></button>
          )}
        </form>
      </div>

      <style>{`
        .chat-detail-screen {
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: #000;
          color: white;
          max-width: 500px;
          margin: 0 auto;
          position: relative;
          overflow: hidden;
        }

        .chat-header {
          display: flex;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid #262626;
          gap: 12px;
          background: rgba(0,0,0,0.8);
          backdrop-filter: blur(10px);
          z-index: 10;
        }

        .header-user {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .header-user img { width: 36px; height: 36px; border-radius: 50%; border: 1px solid #262626; }
        .header-user h3 { font-size: 15px; font-weight: 600; }
        .online-tag { font-size: 11px; color: #4caf50; font-weight: 600; }

        .messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
        }

        .messages-list { display: flex; flex-direction: column; gap: 10px; }

        .message-bubble {
          max-width: 80%;
          padding: 8px 14px;
          border-radius: 18px;
          font-size: 14px;
          line-height: 1.4;
        }

        .message-bubble.sent { align-self: flex-end; background: var(--accent); border-bottom-right-radius: 4px; }
        .message-bubble.received { align-self: flex-start; background: #262626; border-bottom-left-radius: 4px; }

        .msg-media {
          width: 100%;
          max-width: 200px;
          border-radius: 12px;
          margin: 4px 0;
        }

        .message-time { font-size: 10px; opacity: 0.5; display: block; margin-top: 4px; text-align: right; }

        .input-outer { padding: 12px 16px 24px; background: #000; }

        .message-input-area { display: flex; align-items: center; gap: 12px; }

        .input-wrapper {
          flex: 1;
          display: flex;
          align-items: center;
          background: #121212;
          border: 1px solid #262626;
          border-radius: 24px;
          padding: 0 14px;
        }

        .input-wrapper input {
          flex: 1;
          background: transparent;
          border: none;
          color: white;
          padding: 12px 0;
          font-size: 14px;
          outline: none;
        }

        .media-picker {
          position: absolute;
          bottom: 80px;
          left: 0;
          right: 0;
          background: #121212;
          border-top: 1px solid #262626;
          height: 300px;
          z-index: 20;
          display: flex;
          flex-direction: column;
        }

        .picker-header {
          padding: 12px;
          display: flex;
          gap: 12px;
          border-bottom: 1px solid #262626;
        }

        .search-box {
          flex: 1;
          background: #262626;
          border-radius: 8px;
          display: flex;
          align-items: center;
          padding: 0 10px;
          gap: 8px;
        }

        .search-box input {
          background: transparent;
          border: none;
          color: white;
          width: 100%;
          padding: 8px 0;
          font-size: 13px;
          outline: none;
        }

        .gif-grid {
          flex: 1;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          padding: 12px;
          overflow-y: auto;
        }

        .gif-grid img {
          width: 100%;
          height: 100px;
          object-fit: cover;
          border-radius: 8px;
          cursor: pointer;
          transition: transform 0.2s;
        }

        .gif-grid img:hover { transform: scale(1.05); }

        .send-btn { color: var(--accent); font-weight: 700; font-size: 14px; padding: 0 4px; }
      `}</style>
    </div>
  );
};

export default ChatDetail;

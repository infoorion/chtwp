import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { socket, apiFetch } from '../utils/socketClient';
import { ChevronLeft, Info, Send, Image as ImageIcon, Smile, MoreHorizontal, X, Mic, Trash2, CornerUpLeft, Check, CheckCheck, Camera, Phone, Video } from 'lucide-react';

const ChatDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const scrollRef = useRef();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await apiFetch(`/messages/${user.id}/${id}`);
        setMessages(data);
        setLoading(false);
        socket.emit('mark_seen', { senderId: id, receiverId: user.id });
      } catch (err) { console.error(err); }
    };
    fetchHistory();
  }, [id, user.id]);

  useEffect(() => {
    const onMsg = (msg) => {
      if ((String(msg.sender_id) === String(user.id) && String(msg.receiver_id) === String(id)) || 
          (String(msg.sender_id) === String(id) && String(msg.receiver_id) === String(user.id))) {
        setMessages(prev => [...prev.filter(m => m.id !== msg.id), msg]);
        if (String(msg.receiver_id) === String(user.id)) {
          socket.emit('mark_seen', { senderId: id, receiverId: user.id });
        }
      }
    };

    const onStatus = ({ receiverId, status }) => {
      if (String(receiverId) === String(user.id)) {
        setMessages(prev => prev.map(m => m.receiver_id === id ? { ...m, status: 'seen' } : m));
      }
    };

    socket.on('receive_message', onMsg);
    socket.on('status_update', onStatus);
    socket.on('message_deleted', (mid) => setMessages(prev => prev.filter(m => m.id !== mid)));

    return () => {
      socket.off('receive_message');
      socket.off('status_update');
      socket.off('message_deleted');
    };
  }, [id, user.id]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = (content, type = 'text') => {
    if (type === 'text' && !content.trim()) return;
    const msg = {
      sender_id: String(user.id),
      receiver_id: String(id),
      text: type === 'text' ? content : '',
      media_url: type !== 'text' ? content : null,
      type,
      reply_to: replyTo ? { id: replyTo.id, text: replyTo.text, sender: replyTo.sender_name } : null,
      sender_name: user.username
    };
    socket.emit('send_message', msg);
    setNewMessage('');
    setReplyTo(null);
  };

  const MessageTicks = ({ status, isSent }) => {
    if (!isSent) return null;
    if (status === 'seen') return <CheckCheck size={14} color="#40c4ff" className="tick-icon" />;
    return <CheckCheck size={14} color="#8e8e8e" className="tick-icon" />;
  };

  return (
    <div className="chat-premium-screen">
      {/* Dynamic Background */}
      <div className="chat-bg-overlay" />
      
      <header className="chat-premium-header">
        <div className="header-left">
          <button onClick={() => navigate('/chats')} className="back-btn">
            <ChevronLeft size={32} />
          </button>
          <div className="header-user-info">
            <div className="avatar-wrapper">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`} alt="" />
              <div className="online-dot-mini" />
            </div>
            <div className="user-text">
              <h3>{id}</h3>
              <span>Active now</span>
            </div>
          </div>
        </div>
        <div className="header-right">
          <button className="icon-btn-p"><Phone size={20} /></button>
          <button className="icon-btn-p"><Video size={22} /></button>
          <button className="icon-btn-p"><Info size={22} /></button>
        </div>
      </header>

      <div className="chat-premium-body" onClick={() => setSelectedMessage(null)}>
        <div className="chat-date-separator">Today</div>
        
        {messages.map((m) => (
          <div key={m.id} className={`p-msg-row ${m.sender_id === String(user.id) ? 'me' : 'them'}`}>
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onContextMenu={(e) => { e.preventDefault(); setSelectedMessage(m); }}
              onClick={(e) => { e.stopPropagation(); setSelectedMessage(m === selectedMessage ? null : m); }}
              className="p-msg-card"
            >
              {m.reply_to && (
                <div className="p-reply-box">
                  <span className="reply-sender">{m.reply_to.sender}</span>
                  <p>{m.reply_to.text || 'Media'}</p>
                </div>
              )}
              
              <div className="p-bubble">
                {m.type === 'image' ? (
                  <img src={m.media_url} className="p-msg-img" alt="shared" />
                ) : m.text}
                
                <div className="p-msg-meta">
                  <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <MessageTicks status={m.status} isSent={m.sender_id === String(user.id)} />
                </div>
              </div>

              <AnimatePresence>
                {selectedMessage?.id === m.id && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="p-msg-menu">
                    <button onClick={() => setReplyTo(m)}><CornerUpLeft size={16} /> Reply</button>
                    {m.sender_id === String(user.id) && (
                      <button onClick={() => socket.emit('delete_message', { messageId: m.id, userId: user.id })} className="delete-opt">
                        <Trash2 size={16} /> Unsend
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      <div className="chat-premium-footer">
        <AnimatePresence>
          {replyTo && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="p-reply-bar">
              <div className="p-reply-indicator" />
              <div className="p-reply-details">
                <span>Replying to {replyTo.sender_name}</span>
                <p>{replyTo.text || 'Media'}</p>
              </div>
              <button onClick={() => setReplyTo(null)} className="close-reply"><X size={18} /></button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-input-row">
          <button className="p-side-btn"><Smile size={26} /></button>
          
          <div className="p-input-container">
            <input 
              placeholder="Message..." 
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleSend(newMessage)}
            />
            <div className="p-input-actions">
              <label className="p-action-btn">
                <Camera size={22} />
                <input type="file" hidden onChange={e => {
                  const r = new FileReader(); r.onload = () => handleSend(r.result, 'image'); r.readAsDataURL(e.target.files[0]);
                }} />
              </label>
              <button className="p-action-btn"><ImageIcon size={22} /></button>
            </div>
          </div>

          <div className="p-main-action">
            {newMessage.trim() ? (
              <motion.button 
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                onClick={() => handleSend(newMessage)} 
                className="p-send-btn"
              >
                <Send size={22} />
              </motion.button>
            ) : (
              <motion.button 
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                className={`p-mic-btn ${isRecording ? 'recording' : ''}`}
              >
                <Mic size={24} />
              </motion.button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .chat-premium-screen {
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: #000;
          color: white;
          max-width: 500px;
          margin: 0 auto;
          position: relative;
          font-family: 'Inter', sans-serif;
        }

        .chat-bg-overlay {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at top right, rgba(131, 58, 180, 0.15), transparent),
                      radial-gradient(circle at bottom left, rgba(252, 176, 69, 0.1), transparent);
          z-index: 0;
          pointer-events: none;
        }

        .chat-premium-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: rgba(0,0,0,0.8);
          backdrop-filter: blur(15px);
          border-bottom: 1px solid rgba(255,255,255,0.08);
          z-index: 10;
        }

        .header-left { display: flex; align-items: center; gap: 8px; }
        .back-btn { color: #fff; padding: 4px; margin-left: -8px; }
        .header-user-info { display: flex; align-items: center; gap: 12px; }
        .avatar-wrapper { position: relative; width: 40px; height: 40px; }
        .avatar-wrapper img { width: 100%; height: 100%; border-radius: 50%; border: 1.5px solid rgba(255,255,255,0.1); }
        .online-dot-mini { position: absolute; bottom: 2px; right: 2px; width: 10px; height: 10px; background: #4caf50; border: 2px solid #000; border-radius: 50%; }
        .user-text h3 { font-size: 16px; font-weight: 700; }
        .user-text span { font-size: 11px; color: #4caf50; font-weight: 600; }
        .header-right { display: flex; gap: 16px; color: #fff; }
        .icon-btn-p { opacity: 0.9; transition: opacity 0.2s; }
        .icon-btn-p:hover { opacity: 1; }

        .chat-premium-body {
          flex: 1;
          overflow-y: auto;
          padding: 20px 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          z-index: 1;
          scrollbar-width: none;
        }

        .chat-date-separator {
          align-self: center;
          font-size: 11px;
          font-weight: 700;
          color: rgba(255,255,255,0.4);
          text-transform: uppercase;
          letter-spacing: 1px;
          margin: 10px 0;
        }

        .p-msg-row { display: flex; flex-direction: column; width: 100%; }
        .p-msg-row.me { align-items: flex-end; }
        .p-msg-row.them { align-items: flex-start; }
        .p-msg-card { position: relative; max-width: 85%; display: flex; flex-direction: column; }

        .p-bubble {
          padding: 10px 14px;
          border-radius: 20px;
          font-size: 15px;
          line-height: 1.4;
          box-shadow: 0 2px 10px rgba(0,0,0,0.2);
          position: relative;
        }

        .me .p-bubble { background: var(--accent); color: #fff; border-bottom-right-radius: 4px; }
        .them .p-bubble { background: #262626; color: #fff; border-bottom-left-radius: 4px; }

        .p-msg-img { width: 100%; max-width: 260px; border-radius: 14px; margin-bottom: 4px; }

        .p-reply-box {
          background: rgba(255,255,255,0.08);
          padding: 8px 12px;
          border-left: 3px solid #fff;
          border-radius: 10px;
          margin-bottom: 6px;
          font-size: 12px;
          backdrop-filter: blur(5px);
        }
        .reply-sender { font-weight: 800; display: block; margin-bottom: 2px; color: rgba(255,255,255,0.9); }

        .p-msg-meta {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 4px;
          margin-top: 4px;
          font-size: 10px;
          opacity: 0.6;
        }

        .p-msg-menu {
          position: absolute;
          bottom: 110%;
          right: 0;
          background: #1a1a1a;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 14px;
          padding: 6px;
          z-index: 50;
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 130px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.6);
        }
        .p-msg-menu button {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          border-radius: 8px;
          transition: background 0.2s;
        }
        .p-msg-menu button:hover { background: rgba(255,255,255,0.05); }
        .delete-opt { color: #ed4956 !important; }

        .chat-premium-footer {
          background: rgba(0,0,0,0.8);
          backdrop-filter: blur(20px);
          border-top: 1px solid rgba(255,255,255,0.08);
          padding-bottom: 30px;
        }

        .p-reply-bar {
          display: flex;
          align-items: center;
          padding: 12px 16px;
          gap: 12px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .p-reply-indicator { width: 4px; height: 34px; background: var(--accent); border-radius: 2px; }
        .p-reply-details { flex: 1; }
        .p-reply-details span { font-size: 12px; font-weight: 800; color: var(--accent); }
        .p-reply-details p { font-size: 14px; opacity: 0.7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 300px; }

        .p-input-row { display: flex; align-items: center; padding: 12px 12px; gap: 12px; }
        .p-side-btn { color: #fff; opacity: 0.8; }
        
        .p-input-container {
          flex: 1;
          background: #121212;
          border-radius: 26px;
          display: flex;
          align-items: center;
          padding: 0 16px;
          border: 1px solid rgba(255,255,255,0.1);
          height: 48px;
        }
        .p-input-container input {
          flex: 1;
          background: transparent;
          border: none;
          color: white;
          font-size: 15px;
          outline: none;
        }
        .p-input-actions { display: flex; gap: 14px; color: #fff; opacity: 0.8; }
        
        .p-main-action { width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; }
        .p-send-btn { background: var(--accent); width: 100%; height: 100%; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
        .p-mic-btn { color: #fff; width: 100%; height: 100%; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .p-mic-btn.recording { background: #ed4956; animation: pulse-mic 1s infinite; }

        @keyframes pulse-mic {
          0% { transform: scale(1); }
          50% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default ChatDetail;

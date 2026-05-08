import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { socket, apiFetch } from '../utils/socketClient';
import { ChevronLeft, Info, Send, Image as ImageIcon, Smile, MoreHorizontal, X, Search, Mic, Trash2, CornerUpLeft, Play, Pause } from 'lucide-react';

const ChatDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [showGifs, setShowGifs] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const scrollRef = useRef();

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
    socket.on('receive_message', (msg) => {
      if ((String(msg.sender_id) === String(user.id) && String(msg.receiver_id) === String(id)) || 
          (String(msg.sender_id) === String(id) && String(msg.receiver_id) === String(user.id))) {
        setMessages(prev => [...prev.filter(m => m.id !== msg.id), msg]);
      }
    });

    socket.on('message_deleted', (messageId) => {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    });

    return () => {
      socket.off('receive_message');
      socket.off('message_deleted');
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
      reply_to: replyTo ? { id: replyTo.id, text: replyTo.text, sender: replyTo.sender_name } : null,
      sender_name: user.username,
      sender_avatar: user.avatar
    };

    socket.emit('send_message', msgData);
    setNewMessage('');
    setReplyTo(null);
    setShowGifs(false);
  };

  const handleUnsend = (messageId) => {
    socket.emit('delete_message', { messageId, userId: user.id });
    setSelectedMessage(null);
  };

  // Voice Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/ogg; codecs=opus' });
        const reader = new FileReader();
        reader.onloadend = () => handleSendMessage(reader.result, 'audio');
        reader.readAsDataURL(blob);
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      alert('Microphone access denied');
    }
  };

  const stopRecording = () => {
    mediaRecorder?.stop();
    setIsRecording(false);
  };

  return (
    <div className="chat-detail-screen">
      <header className="chat-header">
        <button onClick={() => navigate('/chats')} className="icon-btn"><ChevronLeft size={24} /></button>
        <div className="header-user">
          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`} alt="User" />
          <div className="user-info">
            <h3>{id}</h3>
            <span className="online-tag">Online</span>
          </div>
        </div>
      </header>

      <div className="messages-container" onClick={() => setSelectedMessage(null)}>
        {loading ? (
          <div className="loading-chat">Loading...</div>
        ) : (
          <div className="messages-list">
            {messages.map((msg) => (
              <motion.div 
                key={msg.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`message-wrapper ${msg.sender_id === String(user.id) ? 'sent' : 'received'}`}
                onContextMenu={(e) => { e.preventDefault(); setSelectedMessage(msg); }}
                onClick={(e) => { e.stopPropagation(); setSelectedMessage(msg === selectedMessage ? null : msg); }}
              >
                {msg.reply_to && (
                  <div className="reply-quote">
                    <span className="reply-user">{msg.reply_to.sender}</span>
                    <p>{msg.reply_to.text || 'Media'}</p>
                  </div>
                )}
                
                <div className="bubble-with-actions">
                  <div className="message-bubble">
                    {msg.type === 'audio' ? (
                      <div className="audio-player">
                        <Play size={16} />
                        <div className="audio-wave" />
                        <span>Voice</span>
                      </div>
                    ) : (msg.type === 'image' || msg.type === 'gif') ? (
                      <img src={msg.media_url} className="msg-media" alt="media" />
                    ) : msg.text}
                  </div>
                  
                  <AnimatePresence>
                    {selectedMessage?.id === msg.id && (
                      <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="bubble-menu">
                        <button onClick={() => setReplyTo(msg)}><CornerUpLeft size={16}/></button>
                        {msg.sender_id === String(user.id) && (
                          <button onClick={() => handleUnsend(msg.id)} className="unsend-btn"><Trash2 size={16}/></button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))}
            <div ref={scrollRef} />
          </div>
        )}
      </div>

      <div className="input-area-wrapper">
        <AnimatePresence>
          {replyTo && (
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="reply-preview">
              <div className="reply-content">
                <span>Replying to {replyTo.sender_name}</span>
                <p>{replyTo.text || 'Media'}</p>
              </div>
              <button onClick={() => setReplyTo(null)}><X size={16}/></button>
            </motion.div>
          )}
        </AnimatePresence>

        <form className="message-input-area" onSubmit={(e) => { e.preventDefault(); handleSendMessage(newMessage); }}>
          <button type="button" className="icon-btn" onClick={() => setShowGifs(!showGifs)}><Smile size={24} /></button>
          
          <div className="input-wrapper">
            <input 
              type="text" 
              placeholder={isRecording ? 'Recording...' : 'Message...'} 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={isRecording}
            />
          </div>

          {newMessage.trim() ? (
            <button type="submit" className="send-btn">Send</button>
          ) : (
            <button 
              type="button" 
              className={`mic-btn ${isRecording ? 'recording' : ''}`}
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
            >
              <Mic size={24} />
            </button>
          )}
        </form>
      </div>

      <style>{`
        .chat-detail-screen { height: 100vh; display: flex; flex-direction: column; background: #000; color: white; max-width: 500px; margin: 0 auto; position: relative; }
        .chat-header { display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid #262626; gap: 12px; }
        .header-user { flex: 1; display: flex; align-items: center; gap: 12px; }
        .header-user img { width: 36px; height: 36px; border-radius: 50%; }
        .messages-container { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; }
        .message-wrapper { margin-bottom: 8px; display: flex; flex-direction: column; }
        .message-wrapper.sent { align-items: flex-end; }
        .message-wrapper.received { align-items: flex-start; }
        .bubble-with-actions { display: flex; align-items: center; gap: 8px; }
        .sent .bubble-with-actions { flex-direction: row-reverse; }
        .message-bubble { padding: 10px 16px; border-radius: 20px; font-size: 14px; background: #262626; max-width: 280px; }
        .sent .message-bubble { background: var(--accent); border-bottom-right-radius: 4px; }
        .received .message-bubble { border-bottom-left-radius: 4px; }
        .reply-quote { background: #1a1a1a; padding: 6px 12px; border-left: 3px solid var(--accent); border-radius: 8px; margin-bottom: 4px; font-size: 12px; opacity: 0.8; max-width: 200px; }
        .reply-user { font-weight: 700; color: var(--accent); display: block; }
        .bubble-menu { background: #1a1a1a; border-radius: 20px; display: flex; padding: 4px 8px; gap: 8px; border: 1px solid #262626; }
        .bubble-menu button { color: #8e8e8e; padding: 4px; }
        .unsend-btn { color: #ed4956 !important; }
        .msg-media { width: 100%; max-width: 200px; border-radius: 12px; }
        .reply-preview { background: #121212; padding: 8px 16px; border-left: 4px solid var(--accent); display: flex; justify-content: space-between; align-items: center; }
        .reply-content span { font-size: 11px; font-weight: 700; color: var(--accent); }
        .reply-content p { font-size: 13px; color: #8e8e8e; }
        .input-area-wrapper { background: #000; border-top: 1px solid #262626; }
        .message-input-area { padding: 12px 16px; display: flex; align-items: center; gap: 12px; }
        .input-wrapper { flex: 1; background: #121212; border-radius: 24px; padding: 0 16px; border: 1px solid #262626; }
        .input-wrapper input { background: transparent; border: none; color: white; padding: 10px 0; width: 100%; outline: none; }
        .mic-btn { color: white; padding: 4px; transition: all 0.2s; }
        .mic-btn.recording { color: #ed4956; transform: scale(1.3); }
        .audio-player { display: flex; align-items: center; gap: 8px; }
        .audio-wave { flex: 1; height: 2px; background: rgba(255,255,255,0.3); border-radius: 1px; width: 60px; }
      `}</style>
    </div>
  );
};

export default ChatDetail;

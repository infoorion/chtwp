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
  const [showEmoji, setShowEmoji] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const scrollRef = useRef();

  const emojis = ['😂','❤️','😍','🤣','😊','🙏','😭','😘','👍','✨','🔥','🤔','💀','🙌','✔️','👀','🎉','💙','✅','🌈'];

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
      setMessages(prev => prev.map(m => (m.receiver_id === id && m.sender_id === user.id) ? { ...m, status: 'seen' } : m));
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
      sender_name: user.username,
      status: 'sent'
    };
    socket.emit('send_message', msg);
    setNewMessage('');
    setReplyTo(null);
    setShowEmoji(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => handleSend(reader.result, 'audio');
        reader.readAsDataURL(blob);
      };
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) { alert('Microphone required'); }
  };

  const stopRecording = () => {
    mediaRecorder?.stop();
    setIsRecording(false);
  };

  const MessageTicks = ({ status, isSent }) => {
    if (!isSent) return null;
    return (
      <div className="ticks-container">
        {status === 'seen' ? (
          <CheckCheck size={14} color="#00d2ff" strokeWidth={3} />
        ) : (
          <CheckCheck size={14} color="rgba(255,255,255,0.4)" strokeWidth={2} />
        )}
      </div>
    );
  };

  return (
    <div className="p-chat-wrapper">
      <header className="p-chat-header">
        <button onClick={() => navigate('/chats')} className="p-back"><ChevronLeft size={28} /></button>
        <div className="p-header-user">
          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`} alt="" />
          <div>
            <h3>{id}</h3>
            <span>Online</span>
          </div>
        </div>
        <div className="p-header-actions">
          <button><Phone size={20} /></button>
          <button><Video size={22} /></button>
        </div>
      </header>

      <div className="p-chat-body" onClick={() => { setSelectedMessage(null); setShowEmoji(false); }}>
        <div className="p-chat-bg" />
        {messages.map((m) => (
          <div key={m.id} className={`p-bubble-row ${m.sender_id === String(user.id) ? 'me' : 'them'}`}>
            <motion.div 
              whileTap={{ scale: 0.98 }}
              onContextMenu={(e) => { e.preventDefault(); setSelectedMessage(m); }}
              onClick={(e) => { e.stopPropagation(); setSelectedMessage(m === selectedMessage ? null : m); }}
              className="p-bubble-card"
            >
              {m.reply_to && (
                <div className="p-quote">
                  <b>{m.reply_to.sender}</b>
                  <p>{m.reply_to.text || 'Media'}</p>
                </div>
              )}
              <div className="p-bubble-main">
                {m.type === 'audio' ? <div className="p-voice">Voice Note 🎵</div> :
                 m.type === 'image' ? <img src={m.media_url} className="p-media" alt="" /> : m.text}
                <div className="p-meta">
                  <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <MessageTicks status={m.status} isSent={m.sender_id === String(user.id)} />
                </div>
              </div>

              <AnimatePresence>
                {selectedMessage?.id === m.id && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-menu">
                    <button onClick={() => setReplyTo(m)}><CornerUpLeft size={16} /> Reply</button>
                    {m.sender_id === String(user.id) && (
                      <button onClick={() => socket.emit('delete_message', { messageId: m.id, userId: user.id })} className="del"><Trash2 size={16} /> Unsend</button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      <div className="p-chat-footer">
        <AnimatePresence>
          {showEmoji && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} className="emoji-p">
              {emojis.map(e => <button key={e} onClick={() => setNewMessage(prev => prev + e)}>{e}</button>)}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {replyTo && (
            <div className="p-reply-bar">
              <div className="p-reply-line" />
              <div className="p-reply-info">
                <span>Replying to {replyTo.sender_name}</span>
                <p>{replyTo.text || 'Media'}</p>
              </div>
              <button onClick={() => setReplyTo(null)}><X size={18} /></button>
            </div>
          )}
        </AnimatePresence>

        <div className="p-input-line">
          <button className="p-icon" onClick={() => setShowEmoji(!showEmoji)}><Smile size={24} color={showEmoji ? '#00d2ff' : '#fff'} /></button>
          <div className="p-input-box">
            <input 
              placeholder={isRecording ? "Recording..." : "Message..."} 
              value={newMessage} 
              onChange={e => setNewMessage(e.target.value)} 
              onKeyPress={e => e.key === 'Enter' && handleSend(newMessage)}
              disabled={isRecording}
            />
            <label className="p-icon"><Camera size={22} /><input type="file" hidden onChange={e => {
              const r = new FileReader(); r.onload = () => handleSend(r.result, 'image'); r.readAsDataURL(e.target.files[0]);
            }}/></label>
            <button className="p-icon"><ImageIcon size={22} /></button>
          </div>
          <div className="p-action-slot">
            {newMessage.trim() ? (
              <button onClick={() => handleSend(newMessage)} className="p-send"><Send size={24} /></button>
            ) : (
              <button 
                onMouseDown={startRecording} onMouseUp={stopRecording}
                onTouchStart={startRecording} onTouchEnd={stopRecording}
                className={`p-mic ${isRecording ? 'active' : ''}`}
              >
                <Mic size={24} />
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .p-chat-wrapper { height: 100vh; display: flex; flex-direction: column; background: #09090b; }
        .p-chat-header { display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); gap: 12px; }
        .p-header-user { flex: 1; display: flex; align-items: center; gap: 12px; }
        .p-header-user img { width: 36px; height: 36px; border-radius: 50%; }
        .p-header-user h3 { font-size: 15px; font-weight: 700; color: #fff; }
        .p-header-user span { font-size: 11px; color: #4caf50; }
        .p-header-actions { display: flex; gap: 16px; color: #fff; }
        .p-chat-body { flex: 1; overflow-y: auto; padding: 20px 16px; position: relative; z-index: 1; display: flex; flex-direction: column; gap: 12px; }
        .p-chat-bg { position: absolute; inset: 0; background-image: radial-gradient(circle at 2px 2px, rgba(255,255,255,0.03) 1px, transparent 0); background-size: 24px 24px; z-index: -1; }
        .p-bubble-row { display: flex; width: 100%; }
        .p-bubble-row.me { justify-content: flex-end; }
        .p-bubble-card { max-width: 80%; position: relative; }
        .p-bubble-main { padding: 10px 14px; border-radius: 18px; font-size: 15px; color: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .me .p-bubble-main { background: linear-gradient(135deg, #00d2ff, #3a7bd5); border-bottom-right-radius: 4px; }
        .them .p-bubble-main { background: #18181b; border-bottom-left-radius: 4px; border: 1px solid rgba(255,255,255,0.05); }
        .p-media { width: 100%; max-width: 250px; border-radius: 12px; }
        .p-voice { display: flex; align-items: center; gap: 8px; font-style: italic; opacity: 0.9; }
        .p-quote { background: rgba(255,255,255,0.05); padding: 6px 10px; border-left: 3px solid #00d2ff; border-radius: 6px; margin-bottom: 4px; font-size: 12px; }
        .p-meta { display: flex; justify-content: flex-end; align-items: center; gap: 4px; margin-top: 4px; font-size: 10px; opacity: 0.5; }
        .p-menu { position: absolute; bottom: 110%; right: 0; background: #18181b; border-radius: 12px; padding: 6px; z-index: 100; border: 1px solid rgba(255,255,255,0.1); display: flex; flex-direction: column; min-width: 120px; }
        .p-menu button { display: flex; align-items: center; gap: 10px; padding: 10px; color: #fff; font-size: 14px; }
        .p-menu .del { color: #ff0055; }
        .p-chat-footer { background: #09090b; border-top: 1px solid rgba(255,255,255,0.05); padding-bottom: 24px; }
        .emoji-p { display: grid; grid-template-columns: repeat(8, 1fr); padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .emoji-p button { font-size: 24px; padding: 4px; }
        .p-reply-bar { display: flex; align-items: center; padding: 10px 16px; gap: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .p-reply-line { width: 4px; height: 30px; background: #00d2ff; border-radius: 2px; }
        .p-reply-info span { font-size: 11px; font-weight: 800; color: #00d2ff; }
        .p-reply-info p { font-size: 13px; opacity: 0.7; }
        .p-input-line { display: flex; align-items: center; padding: 12px; gap: 12px; }
        .p-input-box { flex: 1; background: #18181b; border-radius: 24px; display: flex; align-items: center; padding: 0 16px; border: 1px solid rgba(255,255,255,0.05); }
        .p-input-box input { flex: 1; background: transparent; border: none; color: #fff; padding: 12px 0; outline: none; }
        .p-icon { color: rgba(255,255,255,0.6); margin: 0 4px; cursor: pointer; }
        .p-action-slot { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; }
        .p-send { color: #00d2ff; }
        .p-mic { color: #fff; }
        .p-mic.active { color: #ff0055; transform: scale(1.2); animation: p-pulse 1s infinite; }
        @keyframes p-pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
      `}</style>
    </div>
  );
};

export default ChatDetail;

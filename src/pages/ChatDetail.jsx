import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { socket, apiFetch } from '../utils/socketClient';
import { ChevronLeft, Info, Send, Image as ImageIcon, Smile, MoreHorizontal, X, Mic, Trash2, CornerUpLeft, Check, CheckCheck } from 'lucide-react';

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

  // Fetch History
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await apiFetch(`/messages/${user.id}/${id}`);
        setMessages(data);
        setLoading(false);
        // Mark all as seen
        socket.emit('mark_seen', { senderId: id, receiverId: user.id });
      } catch (err) { console.error(err); }
    };
    fetchHistory();
  }, [id, user.id]);

  // Socket
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
    if (status === 'seen') return <CheckCheck size={14} color="#40c4ff" />;
    return <CheckCheck size={14} color="#8e8e8e" />;
  };

  return (
    <div className="chat-screen-v2">
      <header className="chat-header-v2">
        <button onClick={() => navigate('/chats')}><ChevronLeft size={28} /></button>
        <div className="header-info">
          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`} alt="" />
          <div>
            <h3>{id}</h3>
            <span>Active now</span>
          </div>
        </div>
      </header>

      <div className="chat-body" onClick={() => setSelectedMessage(null)}>
        {messages.map((m) => (
          <div key={m.id} className={`msg-row ${m.sender_id === String(user.id) ? 'me' : 'them'}`}>
            <motion.div 
              whileTap={{ scale: 0.98 }}
              onContextMenu={(e) => { e.preventDefault(); setSelectedMessage(m); }}
              className="msg-content-wrapper"
            >
              {m.reply_to && (
                <div className="msg-reply-box">
                  <b>{m.reply_to.sender}</b>
                  <p>{m.reply_to.text || 'Media'}</p>
                </div>
              )}
              <div className="msg-bubble-v2">
                {m.type === 'image' ? <img src={m.media_url} className="msg-img" /> : m.text}
                <div className="msg-meta">
                  <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <MessageTicks status={m.status} isSent={m.sender_id === String(user.id)} />
                </div>
              </div>

              <AnimatePresence>
                {selectedMessage?.id === m.id && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="msg-actions-popup">
                    <button onClick={() => setReplyTo(m)}><CornerUpLeft size={18} /> Reply</button>
                    {m.sender_id === String(user.id) && (
                      <button onClick={() => socket.emit('delete_message', { messageId: m.id, userId: user.id })} className="red"><Trash2 size={18} /> Unsend</button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      <div className="input-container-v2">
        <AnimatePresence>
          {replyTo && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} className="reply-bar">
              <div className="reply-bar-content">
                <span>Replying to {replyTo.sender_name}</span>
                <p>{replyTo.text || 'Media'}</p>
              </div>
              <button onClick={() => setReplyTo(null)}><X size={20} /></button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="input-row-v2">
          <button className="icon-btn-v2"><Smile size={24} /></button>
          <div className="input-field-v2">
            <input 
              placeholder="Message..." 
              value={newMessage} 
              onChange={e => setNewMessage(e.target.value)} 
              onKeyPress={e => e.key === 'Enter' && handleSend(newMessage)}
            />
            <label><ImageIcon size={20} /><input type="file" hidden onChange={e => {
              const r = new FileReader(); r.onload = () => handleSend(r.result, 'image'); r.readAsDataURL(e.target.files[0]);
            }}/></label>
          </div>
          {newMessage.trim() ? (
            <button onClick={() => handleSend(newMessage)} className="send-btn-v2"><Send size={24} /></button>
          ) : (
            <button className="mic-btn-v2"><Mic size={24} /></button>
          )}
        </div>
      </div>

      <style>{`
        .chat-screen-v2 { height: 100vh; display: flex; flex-direction: column; background: #000; color: white; max-width: 500px; margin: 0 auto; overflow: hidden; }
        .chat-header-v2 { display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid #262626; gap: 16px; background: #000; }
        .header-info { display: flex; align-items: center; gap: 12px; }
        .header-info img { width: 36px; height: 36px; border-radius: 50%; }
        .header-info h3 { font-size: 15px; font-weight: 700; }
        .header-info span { font-size: 11px; color: #4caf50; }
        .chat-body { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
        .msg-row { display: flex; flex-direction: column; width: 100%; }
        .msg-row.me { align-items: flex-end; }
        .msg-row.them { align-items: flex-start; }
        .msg-content-wrapper { position: relative; max-width: 80%; }
        .msg-bubble-v2 { background: #262626; padding: 8px 12px; border-radius: 18px; font-size: 14px; position: relative; }
        .me .msg-bubble-v2 { background: var(--accent); border-bottom-right-radius: 4px; }
        .them .msg-bubble-v2 { border-bottom-left-radius: 4px; }
        .msg-reply-box { background: rgba(255,255,255,0.1); padding: 6px 12px; border-left: 3px solid #fff; border-radius: 8px; margin-bottom: 4px; font-size: 12px; }
        .msg-meta { display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin-top: 4px; font-size: 10px; opacity: 0.6; }
        .msg-img { width: 100%; border-radius: 12px; }
        .msg-actions-popup { position: absolute; bottom: 100%; right: 0; background: #1a1a1a; border: 1px solid #262626; border-radius: 12px; padding: 8px; z-index: 100; display: flex; flex-direction: column; gap: 8px; min-width: 120px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
        .msg-actions-popup button { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: #fff; width: 100%; padding: 6px; }
        .msg-actions-popup button.red { color: #ed4956; }
        .input-container-v2 { background: #000; border-top: 1px solid #262626; padding-bottom: 20px; }
        .input-row-v2 { display: flex; align-items: center; padding: 12px 16px; gap: 12px; }
        .input-field-v2 { flex: 1; background: #121212; border: 1px solid #262626; border-radius: 24px; display: flex; align-items: center; padding: 0 16px; }
        .input-field-v2 input { flex: 1; background: transparent; border: none; color: white; padding: 12px 0; font-size: 14px; outline: none; }
        .send-btn-v2 { color: var(--accent); }
        .reply-bar { background: #121212; padding: 8px 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #262626; }
        .reply-bar-content { font-size: 12px; border-left: 3px solid var(--accent); padding-left: 10px; }
        .reply-bar-content span { font-weight: 700; color: var(--accent); }
      `}</style>
    </div>
  );
};

export default ChatDetail;

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Camera } from 'lucide-react';

const ProfileSetup = () => {
  const { user, setUser } = useAuth();
  const [name, setName] = useState('');
  const [username, setUsername] = useState(user?.username || '');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name && username) {
      setUser({ ...user, displayName: name, username: username });
      navigate('/chats');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="auth-screen"
    >
      <div className="auth-header">
        <h2 className="title">Complete Your Profile</h2>
        <p className="auth-subtitle">Add a name and username so your friends can find you.</p>
      </div>

      <div className="avatar-upload">
        <div className="avatar-preview">
          <img src={user?.avatar} alt="Avatar" />
          <div className="camera-overlay">
            <Camera size={20} />
          </div>
        </div>
        <button className="change-photo">Change profile photo</button>
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="input-field">
          <input 
            type="text" 
            placeholder="Full Name" 
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="input-field">
          <input 
            type="text" 
            placeholder="Username" 
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
          />
        </div>

        <button 
          type="submit" 
          className={`auth-submit ${(name && username) ? 'active' : ''}`}
          disabled={!name || !username}
        >
          Complete
        </button>
      </form>

      <style>{`
        .auth-screen {
          padding: 40px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 100%;
        }

        .auth-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .title {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .auth-subtitle {
          color: var(--text-secondary);
          font-size: 14px;
        }

        .avatar-upload {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 32px;
        }

        .avatar-preview {
          width: 96px;
          height: 96px;
          border-radius: 50%;
          position: relative;
          overflow: hidden;
          margin-bottom: 12px;
          border: 1px solid var(--border);
        }

        .avatar-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .camera-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .avatar-preview:hover .camera-overlay {
          opacity: 1;
        }

        .change-photo {
          color: var(--accent);
          font-weight: 600;
          font-size: 14px;
        }

        .auth-form {
          width: 100%;
          max-width: 320px;
        }

        .input-field {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 12px;
        }

        input {
          width: 100%;
          font-size: 14px;
        }

        .auth-submit {
          width: 100%;
          background: var(--accent);
          color: white;
          padding: 14px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          opacity: 0.5;
          margin-top: 12px;
        }

        .auth-submit.active {
          opacity: 1;
        }
      `}</style>
    </motion.div>
  );
};

export default ProfileSetup;

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, User } from 'lucide-react';

const Login = () => {
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [step, setStep] = useState(1); // 1: Phone, 2: Username
  const [loading, setLoading] = useState(false);
  const { login, checkUserExists } = useAuth();
  const navigate = useNavigate();

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    if (phone.length < 10) return;

    setLoading(true);
    const user = await checkUserExists(phone);
    setLoading(false);

    if (user) {
      await login(phone);
      navigate('/chats');
    } else {
      setStep(2);
    }
  };

  const handleUsernameSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;

    setLoading(true);
    await login(phone, username);
    setLoading(false);
    navigate('/chats');
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="auth-screen"
    >
      <div className="auth-header">
        <h1 className="logo-text">sgram</h1>
        <p className="auth-subtitle">Real-time connection, redefined.</p>
      </div>

      <AnimatePresence mode="wait">
        {step === 1 ? (
          <motion.form 
            key="phone-step"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            onSubmit={handlePhoneSubmit} 
            className="auth-form"
          >
            <div className="input-group">
              <div className="country-code">+91</div>
              <input 
                type="tel" 
                placeholder="Phone Number" 
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                maxLength={10}
                autoFocus
              />
            </div>
            <button 
              type="submit" 
              className={`auth-submit ${phone.length >= 10 && !loading ? 'active' : ''}`}
              disabled={phone.length < 10 || loading}
            >
              {loading ? 'Checking...' : 'Continue'}
              <ArrowRight size={20} style={{ marginLeft: '8px' }} />
            </button>
          </motion.form>
        ) : (
          <motion.form 
            key="username-step"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            onSubmit={handleUsernameSubmit} 
            className="auth-form"
          >
            <p className="form-info">New here? Pick a username to start.</p>
            <div className="input-group">
              <User size={20} className="input-icon" />
              <input 
                type="text" 
                placeholder="Choose Username" 
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                autoFocus
              />
            </div>
            <button 
              type="submit" 
              className={`auth-submit ${username.length >= 3 && !loading ? 'active' : ''}`}
              disabled={username.length < 3 || loading}
            >
              {loading ? 'Registering...' : 'Get Started'}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="auth-footer">
        Connect instantly with anyone.
      </div>

      <style>{`
        .auth-screen {
          padding: 60px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 100vh;
          justify-content: center;
          background: #000;
        }

        .logo-text {
          font-family: 'Outfit', sans-serif;
          font-size: 56px;
          font-weight: 800;
          margin-bottom: 8px;
          background: var(--gradient-insta);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .auth-subtitle {
          color: #a8a8a8;
          font-size: 15px;
          margin-bottom: 48px;
        }

        .auth-form {
          width: 100%;
          max-width: 320px;
        }

        .form-info {
          color: var(--accent);
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 16px;
          text-align: center;
        }

        .input-group {
          display: flex;
          align-items: center;
          background: #121212;
          border: 1px solid #262626;
          border-radius: 12px;
          padding: 14px 18px;
          margin-bottom: 20px;
        }

        .input-icon {
          color: #a8a8a8;
          margin-right: 12px;
        }

        .country-code {
          padding-right: 12px;
          margin-right: 12px;
          border-right: 1px solid #262626;
          color: #a8a8a8;
          font-weight: 600;
        }

        input {
          flex: 1;
          background: transparent;
          border: none;
          color: white;
          font-size: 16px;
          outline: none;
        }

        .auth-submit {
          width: 100%;
          background: var(--accent);
          color: white;
          padding: 16px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.5;
          pointer-events: none;
          transition: all 0.3s;
        }

        .auth-submit.active {
          opacity: 1;
          pointer-events: auto;
        }

        .auth-footer {
          margin-top: 60px;
          color: #8e8e8e;
          font-size: 12px;
        }
      `}</style>
    </motion.div>
  );
};

export default Login;

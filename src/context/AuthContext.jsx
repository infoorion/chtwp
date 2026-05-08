import React, { createContext, useContext, useState, useEffect } from 'react';
import { socket, apiFetch } from '../utils/socketClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedUser = localStorage.getItem('sgram_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        console.log('[Auth] Restoring session for:', parsed.username);
        setUser(parsed);
        setIsAuthenticated(true);
        
        // Connect and join immediately
        socket.auth = { user: parsed };
        socket.connect();
      }
      setLoading(false);
    };
    initAuth();

    socket.on('connect', () => {
      console.log('[Socket] Connected to server');
      const storedUser = localStorage.getItem('sgram_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        socket.emit('join', parsed);
      }
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected from server');
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
    };
  }, []);

  const checkUserExists = async (phone) => {
    try {
      const data = await apiFetch(`/user/${phone}`);
      return data.id ? data : null;
    } catch (err) {
      return null;
    }
  };

  const login = async (phone, username = null) => {
    try {
      const data = await apiFetch('/login', {
        method: 'POST',
        body: JSON.stringify({ phone, username })
      });

      if (data.id) {
        console.log('[Auth] Login successful:', data.username);
        setUser(data);
        setIsAuthenticated(true);
        localStorage.setItem('sgram_user', JSON.stringify(data));
        
        socket.auth = { user: data };
        socket.connect();
        socket.emit('join', data);
        return data;
      }
      return null;
    } catch (err) {
      console.error('Login error:', err);
      return null;
    }
  };

  const logout = () => {
    console.log('[Auth] Logging out');
    socket.disconnect();
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('sgram_user');
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout, checkUserExists, setUser, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

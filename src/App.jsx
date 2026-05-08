import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import ChatList from './pages/ChatList';
import ChatDetail from './pages/ChatDetail';
import './index.css';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) return (
    <div className="loading-screen">
      <div className="logo-pulse">sgram</div>
    </div>
  );
  
  if (!isAuthenticated) return <Navigate to="/login" />;
  
  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app-container">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route 
              path="/chats" 
              element={
                <ProtectedRoute>
                  <ChatList />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/chat/:id" 
              element={
                <ProtectedRoute>
                  <ChatDetail />
                </ProtectedRoute>
              } 
            />
            <Route path="/" element={<Navigate to="/chats" />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;

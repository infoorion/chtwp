import { io } from 'socket.io-client';

// Automatically detect URL: 
// In dev: http://localhost:3001
// In prod: current window location
const SOCKET_URL = import.meta.env.MODE === 'production' 
  ? window.location.origin 
  : 'http://localhost:3001';

export const socket = io(SOCKET_URL, {
  autoConnect: false
});

export const apiFetch = async (endpoint, options = {}) => {
  const response = await fetch(`${SOCKET_URL}/api${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  return response.json();
};

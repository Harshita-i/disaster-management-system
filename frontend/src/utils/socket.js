// src/utils/socket.js
import { io } from 'socket.io-client';

const socket = io('http://localhost:5001', {
  autoConnect: false // we connect manually after login
});

export default socket;
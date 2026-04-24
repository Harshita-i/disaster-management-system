// src/utils/socket.js
import { io } from 'socket.io-client';

const socketURL =
  import.meta.env.VITE_SOCKET_URL || `http://${window.location.hostname}:5001`;

const socket = io(socketURL, {
  autoConnect: false // we connect manually after login
});

export default socket;
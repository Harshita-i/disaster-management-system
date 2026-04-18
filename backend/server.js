// server.js
const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const sosRoutes = require('./routes/sos');
const alertRoutes = require('./routes/alerts');
const disasterRoutes = require('./routes/disasters');
const userRoutes = require('./routes/users'); 
const chatRoutes = require('./routes/chat');
const predictionRoutes = require('./routes/predictions');

const app = express();
const server = http.createServer(app); // wrap express in http server for socket.io

// ─── SOCKET.IO SETUP ─────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173', // your React dev server (Vite default)
    methods: ['GET', 'POST']
  }
});

// Make io accessible in all route controllers via req.io
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ─── MIDDLEWARE ───────────────────────────────────────────
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json()); // parse JSON request bodies

// ─── ROUTES ───────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/disasters', disasterRoutes);
app.use('/api/users', userRoutes); 
app.use('/api/chat', chatRoutes); 
app.use('/api/predictions', predictionRoutes);

// Health check — visit http://localhost:5001/api/health to confirm server is running
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Disaster management API is running' });
});

// ─── SOCKET.IO EVENTS ────────────────────────────────────
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Join role-based rooms
  // Frontend will call: socket.emit('join', { role: 'ngo' })
  socket.on('join', ({ role }) => {
    socket.join(role); // joins 'victim', 'ngo', or 'admin' room
    console.log(`Socket ${socket.id} joined room: ${role}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Export io so controllers can emit events
module.exports.io = io;

// ─── CONNECT TO MONGODB & START SERVER ───────────────────
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    server.listen(process.env.PORT || 5001, () => {
      console.log(`Server running on port ${process.env.PORT || 5001}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
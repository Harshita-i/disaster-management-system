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

const translateRoutes = require('./routes/translate');

const predictionRoutes = require('./routes/predictions');


const app = express();
const server = http.createServer(app); // wrap express in http server for socket.io
const configuredOrigins = `${process.env.CLIENT_ORIGINS || ''},${process.env.ALLOWED_ORIGINS || ''}`
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const defaultMobileOrigins = [
  'http://localhost',
  'https://localhost',
  'capacitor://localhost',
  'ionic://localhost'
];
const allowAllOrigins = configuredOrigins.includes('*');
const allowedOriginSet = new Set([...configuredOrigins, ...defaultMobileOrigins]);
const corsOrigin = (origin, callback) => {
  // Allow non-browser clients and same-origin requests with no Origin header.
  if (!origin) return callback(null, true);
  if (allowAllOrigins || allowedOriginSet.has(origin)) return callback(null, true);
  return callback(new Error(`CORS blocked for origin: ${origin}`));
};

// ─── SOCKET.IO SETUP ─────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST']
  }
});

// Make io accessible in all route controllers via req.io
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ─── MIDDLEWARE ───────────────────────────────────────────
app.use(cors({ origin: corsOrigin }));
app.use(express.json()); // parse JSON request bodies

// ─── ROUTES ───────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/disasters', disasterRoutes);
app.use('/api/users', userRoutes); 

app.use('/api/translate', translateRoutes);

app.use('/api/chat', chatRoutes); 
app.use('/api/predictions', predictionRoutes);


app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Disaster backend is running',
    health: '/api/health'
  });
});

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
      if (typeof sosRoutes.startSosSlaReconciler === 'function') {
        sosRoutes.startSosSlaReconciler(io);
        console.log('[SOS SLA] periodic reassignment reconciler started (every 60s)');
      }
    });
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
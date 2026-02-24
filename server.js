const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const initializeSystem = require('./utils/initApp'); // <-- NEW
const startCronJobs = require('./utils/cronJobs');   // <-- NEW

// Load env vars
dotenv.config();

// Connect to database and initialize system
// (In Vercel, this runs during the "cold start" of the function)
connectDB().then(async () => {
  await initializeSystem(); // Ensure default Admin & Config exists
  
  //startCronJobs();          // Start background workers
  // NOTE FOR VERCEL: 
  // startCronJobs() is removed because Vercel serverless functions go to sleep,
  // killing background tasks. If you need scheduled tasks later, you will use 
  // Vercel Cron to hit a specific API endpoint (e.g., GET /api/cron/sweep-payments).
});

const app = express();

// const server = http.createServer(app);
// Configure Socket.io for Real-time Webhook updates to frontend
// const io = new Server(server, {
//   cors: {
//     origin: '*', // We will restrict this to your frontend domain in production
//     methods: ['GET', 'POST']
//   }
// });

// Make io accessible globally to controllers
// app.set('io', io);

// Security & Middlewares
app.use(helmet());

// app.use(cors());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

// Crucial for Webhooks: We need raw body for signature verification for gateways like Stripe/PhonePe
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Socket connection logic
// io.on('connection', (socket) => {
//   console.log(`New client connected: ${socket.id}`);
  
//   // A user on the checkout page can join a "room" using their Order ID
//   socket.on('joinOrderRoom', (orderId) => {
//     socket.join(orderId);
//     console.log(`Socket joined order room: ${orderId}`);
//   });

//   socket.on('disconnect', () => {
//     console.log(`Client disconnected: ${socket.id}`);
//   });
// });

// Basic Route for testing
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'success', message: 'API is running perfectly.' });
});
// Health check
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// We will mount our routes here in Phase 2
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/webhooks', require('./routes/webhookRoutes'));
app.use('/api/admin', require('./routes/adminRoutes')); // <-- NEW
app.use('/api/orders', require('./routes/orderRoutes')); // <-- ADDED THIS
app.use('/api/public', require('./routes/publicRoutes'));


// Global Error Handler
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

// FOR SERVER / VPC - Enable this
// const PORT = process.env.PORT || 5001;
// server.listen(PORT, () => {
//   console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
// });

// IMPORTANT FOR VERCEL: 
// We DO NOT use app.listen(PORT). Instead, we export the Express app.
// Vercel will automatically map incoming HTTP requests to this exported app.
module.exports = app;
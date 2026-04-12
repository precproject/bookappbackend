const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const initializeSystem = require('./utils/initApp');
const startCronJobs = require('./utils/cronJobs'); // <-- Imported successfully

const stats = {};

// ==========================================
// 1. ENVIRONMENT & DATABASE
// ==========================================
require('dotenv').config({
  path: '/var/www/config/prod.env'
});

connectDB().then(async () => {
  await initializeSystem();
  
  // CRITICAL FIX: Only start cron jobs on persistent servers (Local or VPS)
  // Vercel serverless functions sleep, which kills background cron tasks.
  if (!process.env.VERCEL) {
    startCronJobs(); 
  }
});

// ==========================================
// 2. APP INITIALIZATION
// ==========================================
const app = express();

// Create HTTP server safely for all environments
const server = http.createServer(app);

// Trust proxy is CRITICAL for Vercel and VPS Nginx to get correct client IPs for rate limiting
app.set('trust proxy', 1); 

// ==========================================
// 3. SECURITY & MIDDLEWARES
// ==========================================
// Helmet secures HTTP headers. Disable CORP globally so our static image uploads work.
app.use(helmet({ crossOriginResourcePolicy: false })); 


// Strict CORS for Production, relaxed for Development
const allowedOrigins = [
  'http://localhost:3000', 
  'https://www.sahakarstree.com',  // Allow with www
  'http://sahakarstree.com',      // Allow without www
  'http://www.sahakarstree.com',  // Allow with www
  process.env.FRONTEND_URL, 
  process.env.VERCEL_TEST_URL 
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow if in allowed list, OR if it's local development, OR if no origin (server-to-server)
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  credentials: true
}));

// Body Parsers (1mb limit to prevent massive payload crashing)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// HTTP Request Logger for Development only
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Serve Static Images securely
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads'), {
  setHeaders: (res) => {
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('Access-Control-Allow-Origin', '*');
  }
}));

// ==========================================
// 4. RATE LIMITING
// ==========================================
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 150, // Allow 150 requests per IP
  message: 'Too many requests from this IP, please try again after 15 minutes',
  keyGenerator: (req) => req.ip,
  handler: (req, res) => {
    stats[req.ip] = (stats[req.ip] || 0) + 1;
    res.status(429).send('Too many requests');
  }
});

app.get('/stats', (req, res) => {
  res.json(stats);
});

app.use('/api/', apiLimiter);

// ==========================================
// 5. WEBSOCKETS (Socket.io)
// ==========================================
// CRITICAL FIX: WebSockets do not work on Vercel Serverless. We only boot them on Local/VPS.
if (!process.env.VERCEL) {
  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });
  
  app.set('io', io); // Make available to controllers via req.app.get('io')

  io.on('connection', (socket) => {
    // console.log(`New client connected: ${socket.id}`);
    socket.on('joinOrderRoom', (orderId) => {
      socket.join(orderId);
    });
  });
}

// ==========================================
// 6. ROUTES
// ==========================================
app.get('/api/health', (req, res) => res.status(200).json({ status: 'success', message: 'API is healthy.' }));
app.get('/', (req, res) => res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/webhooks', require('./routes/webhookRoutes'));
app.use('/api/admin', require('./routes/adminRoutes')); 
app.use('/api/orders', require('./routes/orderRoutes')); 
app.use('/api/public', require('./routes/publicRoutes'));
app.use('/api/discounts', require('./routes/discountRoutes'));
app.use('/api/user', require('./routes/userRoutes'));
app.use('/api/blogs', require('./routes/blogRoutes'));
app.use('/api/config', require('./routes/configRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));
app.use('/api/delivery', require('./routes/deliveryRoutes'));

// ==========================================
// 7. GLOBAL ERROR HANDLER
// ==========================================
app.use((err, req, res, next) => {
  console.error(err.stack); // Log in backend console for debugging
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    message: err.message,
    // Hide stack traces in production to prevent leaking server paths
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

// ==========================================
// 8. SERVER BOOT
// ==========================================
// IMPORTANT FOR VERCEL: We export the app. Vercel maps it automatically to serverless functions.
// IMPORTANT FOR VPS/LOCAL: We tell the HTTP server to actively listen on a port.
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5001;
  server.listen(PORT, () => {
    console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });
}

module.exports = app;
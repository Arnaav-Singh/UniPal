// Bootstraps the Express application, configures API middleware, and mounts routes.
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";
import morgan from "morgan";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import coordinatorRoutes from "./routes/coordinatorRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import eventRoutes from "./routes/eventRoutes.js";
import feedbackRoutes from "./routes/feedbackRoutes.js";
import superadminRoutes from "./routes/superadminRoutes.js";
import facultyRoutes from './routes/facultyRoutes.js';
import googleAuthRoutes from './routes/googleAuthRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import reportRoutes from './routes/reportRoutes.js';

dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET', 'MONGO_URI'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    console.error('Please set this in your .env file');
    process.exit(1);
  }
}

const app = express();
const PORT = process.env.PORT || 5050;

// If running behind a proxy (Render, Vercel, Nginx, etc.), enable correct IP detection for rate-limit
app.set("trust proxy", 1); // safe in dev/prod and recommended for accurate client IPs [8]

// Connect to DB
connectDB();

// Strict CORS config for Vite dev server (support 5173, 5174, and 8080)
// In production, set ALLOWED_ORIGINS env var with comma-separated list
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:8080",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:8080",
  ];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow non-browser and same-origin
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// Global CORS must be first so even errors carry CORS headers
app.use(cors(corsOptions));

// Short-circuit any remaining OPTIONS before other middleware that might block
app.use((req, res, next) => {
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Body/parse
app.use(express.json({ limit: "50mb" }));
app.use(cookieParser());

// Logging
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Security
app.use(helmet());           // sets various security headers [3]
// Custom sanitize to avoid Express 5 readonly req.query reassignment
function sanitizeKeys(obj) {
  if (!obj || typeof obj !== 'object') return;
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      const safeKey = key.replaceAll('$', '').replaceAll('.', '_');
      obj[safeKey] = obj[key];
      delete obj[key];
    } else if (typeof obj[key] === 'object') {
      sanitizeKeys(obj[key]);
    }
  }
}
app.use((req, _res, next) => {
  try {
    if (req.body && typeof req.body === 'object') sanitizeKeys(req.body);
    if (req.params && typeof req.params === 'object') sanitizeKeys(req.params);
    // NOTE: avoid reassigning req.query due to Express 5 read-only getter
  } catch (_) { }
  next();
});

// Rate limit sensitive routes (avoid applying to OPTIONS)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Health check endpoint for Azure monitoring
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Version check endpoint
app.get('/api/version', (req, res) => {
  res.json({ version: '1.1.0', features: ['reports', 'excel-export', 'logo-fix'] });
});

// Routes
app.use("/api/auth", (req, res, next) => {
  if (req.method === "OPTIONS") return res.sendStatus(204);
  return authLimiter(req, res, next);
}, authRoutes);

app.use('/api/superadmin', superadminRoutes);
// Remove or comment out any app.get('*', ...) or router.use('*', ...)

app.use('/api/admin', adminRoutes);
app.use('/api/coordinators', coordinatorRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/notification', notificationRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/google', googleAuthRoutes);
app.use('/api/reports', reportRoutes);

// SPA or 404 fallback LAST
// ...existing code...


// 404 and error handler (keep after routes)
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

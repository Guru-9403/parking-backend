const express   = require('express');
const cors      = require('cors');
require('dotenv').config();

const connectDB      = require('./config/db');
const slotsRouter    = require('./routes/slots');
const parkingRouter  = require('./routes/parking');
const dashboardRouter = require('./routes/dashboard');
const adminRouter    = require('./routes/admin');

const app  = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/slots',     slotsRouter);
app.use('/api/parking',   parkingRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/history',   dashboardRouter);
app.use('/api/admin',     adminRouter);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Root
app.get('/', (_req, res) => {
  res.json({
    message: 'E-Vacant Parking System API (MongoDB)',
    version: '2.0.0',
    endpoints: {
      slots:        'GET  /api/slots',
      vacant:       'GET  /api/slots/vacant',
      park:         'POST /api/parking/park',
      exit:         'POST /api/parking/exit/:slot_id',
      active:       'GET  /api/parking/active',
      dashboard:    'GET  /api/dashboard',
      history:      'GET  /api/history?page=1&limit=50',
      search:       'GET  /api/history/search?vehicle=TN72AB1234',
      adminLogin:   'POST /api/admin/login  [Authorization: Bearer <token>]',
      adminSlots:   'GET  /api/admin/slots  [Authorization: Bearer <token>]',
      adminRevenue: 'GET  /api/admin/revenue [Authorization: Bearer <token>]',
    }
  });
});

// 404
app.use((_req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// Start — connect DB first, then seed slots, then listen
async function start() {
  await connectDB();

  // Seed 20 slots if none exist
  const Slot = require('./models/Slot');
  const count = await Slot.countDocuments();
  if (count === 0) {
    const slots = Array.from({ length: 20 }, (_, i) => ({
      slot_number: `S${String(i + 1).padStart(2, '0')}`
    }));
    await Slot.insertMany(slots);
    console.log('🅿  20 parking slots seeded automatically');
  }

  app.listen(PORT, () => {
    console.log(`🚗 Parking API running at http://localhost:${PORT}`);
    console.log(`🔐 Admin endpoints at /api/admin/* (set ADMIN_TOKEN in .env)`);
  });
}

start();

const express = require('express');
const router  = express.Router();
const { body, validationResult } = require('express-validator');
const Slot           = require('../models/Slot');
const ParkingSession = require('../models/ParkingSession');
const SessionHistory = require('../models/SessionHistory');
const adminAuth      = require('../middleware/adminAuth');
require('dotenv').config();

const RATES = {
  car:   parseFloat(process.env.RATE_CAR)   || 30,
  bike:  parseFloat(process.env.RATE_BIKE)  || 15,
  truck: parseFloat(process.env.RATE_TRUCK) || 60
};

router.use(adminAuth);

// POST /api/admin/login — verify token
router.post('/login', (req, res) => {
  res.json({ success: true, message: 'Admin authenticated' });
});

// GET /api/admin/slots
router.get('/slots', async (req, res) => {
  try {
    const slots    = await Slot.find().sort({ slot_number: 1 });
    const sessions = await ParkingSession.find();
    const sessionMap = {};
    sessions.forEach(s => { sessionMap[s.slot_id.toString()] = s; });

    const now = new Date();
    const data = slots.map(s => {
      const session = sessionMap[s._id.toString()];
      return {
        id:               s._id,
        slot_number:      s.slot_number,
        status:           s.status,
        created_at:       s.created_at,
        vehicle_number:   session?.vehicle_number || null,
        vehicle_type:     session?.vehicle_type   || null,
        entry_time:       session?.entry_time      || null,
        duration_minutes: session ? Math.max(Math.ceil((now - session.entry_time) / 60000), 1) : null
      };
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/slots — add slot
router.post(
  '/slots',
  [body('slot_number').trim().notEmpty().withMessage('Slot number required').isLength({ max: 10 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, errors: errors.array() });

    try {
      const slot = await Slot.create({ slot_number: req.body.slot_number.toUpperCase() });
      res.status(201).json({
        success: true,
        message: `Slot ${slot.slot_number} added`,
        data: slot
      });
    } catch (err) {
      if (err.code === 11000)
        return res.status(409).json({ success: false, message: 'Slot number already exists' });
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// DELETE /api/admin/slots/:id — delete vacant slot
router.delete('/slots/:id', async (req, res) => {
  try {
    const slot = await Slot.findById(req.params.id);
    if (!slot)
      return res.status(404).json({ success: false, message: 'Slot not found' });
    if (slot.status === 'occupied')
      return res.status(409).json({ success: false, message: 'Cannot delete an occupied slot' });

    await Slot.deleteOne({ _id: slot._id });
    res.json({ success: true, message: `Slot ${slot.slot_number} deleted` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/force-exit/:slot_id
router.post('/force-exit/:slot_id', async (req, res) => {
  try {
    const slot = await Slot.findById(req.params.slot_id);
    if (!slot)
      return res.status(404).json({ success: false, message: 'Slot not found' });

    const session = await ParkingSession.findOne({ slot_id: slot._id });
    if (!session)
      return res.status(404).json({ success: false, message: 'No active session for this slot' });

    const exitTime        = new Date();
    const durationMinutes = Math.max(Math.ceil((exitTime - session.entry_time) / 60000), 1);
    const fee             = Math.ceil((durationMinutes / 60) * RATES[session.vehicle_type]);

    await SessionHistory.create({
      slot_number:      slot.slot_number,
      vehicle_number:   session.vehicle_number,
      vehicle_type:     session.vehicle_type,
      entry_time:       session.entry_time,
      exit_time:        exitTime,
      duration_minutes: durationMinutes,
      fee
    });

    await ParkingSession.deleteOne({ _id: session._id });
    slot.status = 'vacant';
    await slot.save();

    res.json({
      success: true,
      message: `Force-exited ${session.vehicle_number}. Fee: ₹${fee}`,
      data: { vehicle_number: session.vehicle_number, fee, duration_minutes: durationMinutes }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/revenue
router.get('/revenue', async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const daily = await SessionHistory.aggregate([
      { $match: { exit_time: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id:      { $dateToString: { format: '%Y-%m-%d', date: '$exit_time' } },
          revenue:  { $sum: '$fee' },
          sessions: { $sum: 1 },
          cars:     { $sum: { $cond: [{ $eq: ['$vehicle_type', 'car']   }, 1, 0] } },
          bikes:    { $sum: { $cond: [{ $eq: ['$vehicle_type', 'bike']  }, 1, 0] } },
          trucks:   { $sum: { $cond: [{ $eq: ['$vehicle_type', 'truck'] }, 1, 0] } }
        }
      },
      { $sort: { _id: -1 } },
      { $project: { date: '$_id', revenue: 1, sessions: 1, cars: 1, bikes: 1, trucks: 1, _id: 0 } }
    ]);

    const totals = await SessionHistory.aggregate([
      {
        $group: {
          _id:          null,
          total_sessions: { $sum: 1 },
          total_revenue:  { $sum: '$fee' },
          avg_fee:        { $avg: '$fee' },
          avg_duration:   { $avg: '$duration_minutes' }
        }
      }
    ]);

    const vehicleSplit = await SessionHistory.aggregate([
      {
        $group: {
          _id:    null,
          cars:   { $sum: { $cond: [{ $eq: ['$vehicle_type', 'car']   }, 1, 0] } },
          bikes:  { $sum: { $cond: [{ $eq: ['$vehicle_type', 'bike']  }, 1, 0] } },
          trucks: { $sum: { $cond: [{ $eq: ['$vehicle_type', 'truck'] }, 1, 0] } }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        daily,
        totals:       totals[0]      || { total_sessions: 0, total_revenue: 0, avg_fee: 0, avg_duration: 0 },
        vehicleSplit: vehicleSplit[0] || { cars: 0, bikes: 0, trucks: 0 }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/history/all
router.get('/history/all', async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit) || 100, 500);
    const page   = Math.max(parseInt(req.query.page)  || 1, 1);
    const skip   = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      SessionHistory.find().sort({ exit_time: -1 }).skip(skip).limit(limit),
      SessionHistory.countDocuments()
    ]);

    res.json({
      success: true,
      data: rows,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/admin/history/:id
router.delete('/history/:id', async (req, res) => {
  try {
    const result = await SessionHistory.findByIdAndDelete(req.params.id);
    if (!result)
      return res.status(404).json({ success: false, message: 'Record not found' });
    res.json({ success: true, message: 'History record deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

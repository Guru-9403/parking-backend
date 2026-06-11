const express = require('express');
const router  = express.Router();
const Slot           = require('../models/Slot');
const ParkingSession = require('../models/ParkingSession');
const SessionHistory = require('../models/SessionHistory');

// GET /api/dashboard
router.get('/', async (req, res) => {
  try {
    const totalSlots = await Slot.countDocuments();
    const occupied   = await Slot.countDocuments({ status: 'occupied' });
    const vacant     = totalSlots - occupied;

    const totalRevenue = await SessionHistory.aggregate([
      { $group: { _id: null, total: { $sum: '$fee' } } }
    ]);

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayStats = await SessionHistory.aggregate([
      { $match: { exit_time: { $gte: today } } },
      { $group: { _id: null, revenue: { $sum: '$fee' }, sessions: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      data: {
        total_slots:    totalSlots,
        occupied,
        vacant,
        total_revenue:  totalRevenue[0]?.total || 0,
        today_revenue:  todayStats[0]?.revenue  || 0,
        today_sessions: todayStats[0]?.sessions || 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/history
router.get('/history', async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit) || 50, 200);
    const page   = Math.max(parseInt(req.query.page)  || 1,  1);
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

// GET /api/history/search?vehicle=TN72AB1234
router.get('/history/search', async (req, res) => {
  const vehicle = (req.query.vehicle || '').trim().toUpperCase();
  if (!vehicle)
    return res.status(400).json({ success: false, message: 'vehicle query param required' });

  try {
    const rows = await SessionHistory.find({
      vehicle_number: { $regex: vehicle, $options: 'i' }
    }).sort({ exit_time: -1 }).limit(20);

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

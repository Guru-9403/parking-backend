const express = require('express');
const router  = express.Router();
const { body, validationResult } = require('express-validator');
const Slot           = require('../models/Slot');
const ParkingSession = require('../models/ParkingSession');
const SessionHistory = require('../models/SessionHistory');
require('dotenv').config();

const RATES = {
  car:   parseFloat(process.env.RATE_CAR)   || 30,
  bike:  parseFloat(process.env.RATE_BIKE)  || 15,
  truck: parseFloat(process.env.RATE_TRUCK) || 60
};

// POST /api/parking/park
router.post(
  '/park',
  [
    body('vehicle_number').trim().toUpperCase().notEmpty().withMessage('Vehicle number is required')
      .isLength({ min: 4, max: 15 }).withMessage('Invalid vehicle number length')
      .matches(/^[A-Z0-9]+$/).withMessage('Vehicle number must be alphanumeric'),
    body('slot_id').notEmpty().withMessage('Valid slot ID is required'),
    body('vehicle_type').isIn(['car', 'bike', 'truck']).withMessage('Vehicle type must be car, bike, or truck')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, errors: errors.array() });

    const { vehicle_number, slot_id, vehicle_type } = req.body;

    try {
      // Check vehicle not already parked
      const existing = await ParkingSession.findOne({ vehicle_number });
      if (existing)
        return res.status(409).json({ success: false, message: 'Vehicle is already parked' });

      // Check slot is vacant
      const slot = await Slot.findById(slot_id);
      if (!slot || slot.status !== 'vacant')
        return res.status(409).json({ success: false, message: 'Slot is not available' });

      // Mark slot occupied
      slot.status = 'occupied';
      await slot.save();

      // Create session
      const session = await ParkingSession.create({
        slot_id:        slot._id,
        slot_number:    slot.slot_number,
        vehicle_number,
        vehicle_type,
        entry_time:     new Date()
      });

      res.status(201).json({
        success: true,
        message: `${vehicle_number} parked in slot ${slot.slot_number}`,
        data: {
          session_id:    session._id,
          slot_number:   slot.slot_number,
          vehicle_number,
          vehicle_type,
          rate_per_hour: RATES[vehicle_type]
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// POST /api/parking/exit/:slot_id
router.post('/exit/:slot_id', async (req, res) => {
  try {
    const slot = await Slot.findById(req.params.slot_id);
    if (!slot)
      return res.status(404).json({ success: false, message: 'Slot not found' });

    const session = await ParkingSession.findOne({ slot_id: slot._id });
    if (!session)
      return res.status(404).json({ success: false, message: 'No active session for this slot' });

    const exitTime       = new Date();
    const durationMs     = exitTime - session.entry_time;
    const durationMinutes = Math.max(Math.ceil(durationMs / 60000), 1);
    const fee            = Math.ceil((durationMinutes / 60) * RATES[session.vehicle_type]);

    // Save to history
    await SessionHistory.create({
      slot_number:      slot.slot_number,
      vehicle_number:   session.vehicle_number,
      vehicle_type:     session.vehicle_type,
      entry_time:       session.entry_time,
      exit_time:        exitTime,
      duration_minutes: durationMinutes,
      fee
    });

    // Delete session & free slot
    await ParkingSession.deleteOne({ _id: session._id });
    slot.status = 'vacant';
    await slot.save();

    res.json({
      success: true,
      message: `${session.vehicle_number} exited. Fee: ₹${fee}`,
      data: {
        slot_number:      slot.slot_number,
        vehicle_number:   session.vehicle_number,
        vehicle_type:     session.vehicle_type,
        entry_time:       session.entry_time,
        exit_time:        exitTime,
        duration_minutes: durationMinutes,
        fee
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/parking/active
router.get('/active', async (req, res) => {
  try {
    const sessions = await ParkingSession.find().sort({ entry_time: 1 });
    const now = new Date();
    const data = sessions.map(s => ({
      slot_id:          s.slot_id,
      slot_number:      s.slot_number,
      vehicle_number:   s.vehicle_number,
      vehicle_type:     s.vehicle_type,
      entry_time:       s.entry_time,
      duration_minutes: Math.max(Math.ceil((now - s.entry_time) / 60000), 1)
    }));
    res.json({ success: true, data, count: data.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

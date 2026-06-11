const express = require('express');
const router  = express.Router();
const Slot    = require('../models/Slot');
const ParkingSession = require('../models/ParkingSession');

// GET /api/slots — all slots with current session info
router.get('/', async (req, res) => {
  try {
    const slots    = await Slot.find().sort({ slot_number: 1 });
    const sessions = await ParkingSession.find();

    // Map session data onto slots
    const sessionMap = {};
    sessions.forEach(s => { sessionMap[s.slot_id.toString()] = s; });

    const data = slots.map(s => {
      const session = sessionMap[s._id.toString()];
      return {
        id:             s._id,
        slot_number:    s.slot_number,
        status:         s.status,
        vehicle_number: session ? session.vehicle_number : null,
        vehicle_type:   session ? session.vehicle_type   : null,
        entry_time:     session ? session.entry_time     : null,
      };
    });

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/slots/vacant — only vacant slots
router.get('/vacant', async (req, res) => {
  try {
    const slots = await Slot.find({ status: 'vacant' }).sort({ slot_number: 1 });
    res.json({ success: true, data: slots, count: slots.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

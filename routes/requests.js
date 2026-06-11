const express = require('express');
const router  = express.Router();
const { body, validationResult } = require('express-validator');
const Slot           = require('../models/Slot');
const ParkingRequest = require('../models/ParkingRequest');

// POST /api/requests — viewer requests a vacant slot
router.post(
  '/',
  [
    body('vehicle_number').trim().toUpperCase().notEmpty().withMessage('Vehicle number is required')
      .isLength({ min: 4, max: 15 }).withMessage('Invalid vehicle number length')
      .matches(/^[A-Z0-9]+$/).withMessage('Vehicle number must be alphanumeric'),
    body('slot_id').notEmpty().withMessage('Slot is required'),
    body('vehicle_type').isIn(['car', 'bike', 'truck']).withMessage('Vehicle type must be car, bike, or truck')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, errors: errors.array() });

    const { vehicle_number, slot_id, vehicle_type } = req.body;

    try {
      const slot = await Slot.findById(slot_id);
      if (!slot || slot.status !== 'vacant')
        return res.status(409).json({ success: false, message: 'Slot is not available' });

      const existing = await ParkingRequest.findOne({ slot_id, status: 'pending' });
      if (existing)
        return res.status(409).json({ success: false, message: 'This slot already has a pending request' });

      const reqDoc = await ParkingRequest.create({
        slot_id, slot_number: slot.slot_number, vehicle_number, vehicle_type
      });

      res.status(201).json({
        success: true,
        message: `Request for slot ${slot.slot_number} submitted. Please wait for admin approval.`,
        data: reqDoc
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// GET /api/requests/:id — check status of a request (for the viewer to poll)
router.get('/:id', async (req, res) => {
  try {
    const r = await ParkingRequest.findById(req.params.id);
    if (!r) return res.status(404).json({ success: false, message: 'Request not found' });
    res.json({ success: true, data: r });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

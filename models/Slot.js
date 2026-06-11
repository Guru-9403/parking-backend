const mongoose = require('mongoose');

const slotSchema = new mongoose.Schema({
  slot_number: { type: String, required: true, unique: true, uppercase: true, trim: true },
  status:      { type: String, enum: ['vacant', 'occupied'], default: 'vacant' },
  created_at:  { type: Date, default: Date.now }
});

module.exports = mongoose.model('Slot', slotSchema);

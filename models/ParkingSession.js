const mongoose = require('mongoose');

const parkingSessionSchema = new mongoose.Schema({
  slot_id:        { type: mongoose.Schema.Types.ObjectId, ref: 'Slot', required: true },
  slot_number:    { type: String, required: true },
  vehicle_number: { type: String, required: true, uppercase: true, trim: true },
  vehicle_type:   { type: String, enum: ['car', 'bike', 'truck'], required: true },
  entry_time:     { type: Date, default: Date.now }
});

// Index for fast lookup
parkingSessionSchema.index({ vehicle_number: 1 });
parkingSessionSchema.index({ slot_id: 1 });

module.exports = mongoose.model('ParkingSession', parkingSessionSchema);

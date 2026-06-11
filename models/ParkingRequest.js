const mongoose = require('mongoose');

const parkingRequestSchema = new mongoose.Schema({
  slot_id:        { type: mongoose.Schema.Types.ObjectId, ref: 'Slot', required: true },
  slot_number:    { type: String, required: true },
  vehicle_number: { type: String, required: true, uppercase: true, trim: true },
  vehicle_type:   { type: String, enum: ['car', 'bike', 'truck'], required: true },
  status:         { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  requested_at:   { type: Date, default: Date.now }
});

module.exports = mongoose.model('ParkingRequest', parkingRequestSchema);

const mongoose = require('mongoose');

const sessionHistorySchema = new mongoose.Schema({
  slot_number:      { type: String, required: true },
  vehicle_number:   { type: String, required: true, uppercase: true },
  vehicle_type:     { type: String, enum: ['car', 'bike', 'truck'], required: true },
  entry_time:       { type: Date, required: true },
  exit_time:        { type: Date, required: true },
  duration_minutes: { type: Number, required: true },
  fee:              { type: Number, required: true },
  created_at:       { type: Date, default: Date.now }
});

sessionHistorySchema.index({ vehicle_number: 1 });
sessionHistorySchema.index({ exit_time: -1 });

module.exports = mongoose.model('SessionHistory', sessionHistorySchema);

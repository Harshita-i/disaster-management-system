const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  type:      { 
    type: String, 
    enum: ['flood','earthquake','cyclone','fire','tsunami','landslide'],
    required: true 
  },
  severity:  { 
    type: String, 
    enum: ['low','moderate','high','critical'],
    default: 'moderate'
  },
  region:    { type: String, required: true },
  message:   { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  active:    { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Alert', alertSchema);
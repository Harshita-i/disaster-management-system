const mongoose = require('mongoose');

const sosSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  name:     { type: String },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    address: { type: String }
  },
  priority: { 
    type: String, 
    enum: ['red', 'yellow', 'green'], 
    default: 'yellow' 
  },
  status: { 
    type: String, 
    enum: ['pending', 'assigned', 'in-progress', 'resolved'], 
    default: 'pending' 
  },
  assignedTo: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    default: null 
  },
  message:   { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SOS', sosSchema);
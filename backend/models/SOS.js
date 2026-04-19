const mongoose = require('mongoose');

const sosSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: { type: String },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    address: { type: String },
  },
  priority: {
    type: String,
    enum: ['red', 'yellow', 'green'],
    default: 'yellow',
  },
  /** 0–100: urgency for routing / NGO matching */
  priorityScore: { type: Number, default: 50, min: 0, max: 100 },
  /** 0–100: credibility heuristic (never blocks response) */
  trustScore: { type: Number, default: 70, min: 0, max: 100 },
  suspicious: { type: Boolean, default: false },
  /** High urgency but lower credibility — still treated as emergency */
  unverifiedCritical: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['pending', 'assigned', 'in-progress', 'resolved'],
    default: 'pending',
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  /** When status became assigned (response SLA timer) */
  assignedAt: { type: Date },
  /** NGOs not to pick again soon after timeout reassignment */
  reassignmentExcludeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  reassignmentEvents: [
    {
      at: { type: Date, default: Date.now },
      fromNgo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reason: { type: String },
    },
  ],
  /** System picked nearest available NGO */
  autoAssigned: { type: Boolean, default: false },
  message: { type: String },
  /** Total SOS signals while this request is open (manual + voice); >1 can force red outside danger zone */
  triggerCount: { type: Number, default: 1 },
  /** Manual presses only (analytics / UI) */
  manualTriggerCount: { type: Number, default: 0 },
  /** Keyword / voice sends while this SOS is open */
  voiceTriggerCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('SOS', sosSchema);

const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');
const { authenticate, authorize } = require('../middleware/auth');

const ML_BASE_URL = process.env.ML_BASE_URL || 'http://localhost:5002';
const AUTO_ALERT_THRESHOLD = 0.85;
const AUTO_ALERT_WINDOW_MINUTES = 30;

async function broadcastAlert(req, alert) {
  const alertObj = alert.toObject();
  req.io.to('victim').emit('new-alert', alertObj);
  req.io.to('ngo').emit('new-alert', alertObj);
  req.io.to('admin').emit('new-alert', alertObj);
  return alertObj;
}

router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const response = await fetch(`${ML_BASE_URL}/predictions`);

    if (!response.ok) {
      return res.status(502).json({
        message: 'ML service unavailable'
      });
    }

    const predictions = await response.json();
    const autoAlerts = [];

    for (const prediction of predictions) {
      const riskScore = Number(prediction.risk_score || 0);

      if (riskScore <= AUTO_ALERT_THRESHOLD) continue;

      const cutoff = new Date(Date.now() - AUTO_ALERT_WINDOW_MINUTES * 60 * 1000);

      const existing = await Alert.findOne({
        type: 'flood',
        region: prediction.region,
        severity: 'critical',
        createdAt: { $gte: cutoff }
      });

      if (existing) continue;

      const lat = Number(prediction.lat);
      const lng = Number(prediction.lng);
      const location =
        Number.isFinite(lat) && Number.isFinite(lng)
          ? { lat, lng }
          : null;

      const alert = await Alert.create({
        type: 'flood',
        region: prediction.region,
        severity: 'critical',
        message: `Auto alert: ML risk score ${riskScore.toFixed(2)} for ${prediction.region}. Admin verification recommended.`,
        location,
        radius: 10000
      });

      const alertObj = await broadcastAlert(req, alert);
      autoAlerts.push(alertObj);
    }

    res.json({
      predictions,
      autoAlerts
    });
  } catch (err) {
    res.status(500).json({
      message: 'Failed to fetch predictions',
      error: err.message
    });
  }
});

module.exports = router;
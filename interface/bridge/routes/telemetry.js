const express = require('express');
const router = express.Router();
const telemetry = require('../moteur/telemetry');

// POST telemetry session
router.post('/session', async (req, res, next) => {
  try {
    const { sessionData, aiStateBefore, aiStateAfter } = req.body;
    await telemetry.logSession(sessionData, aiStateBefore, aiStateAfter);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST telemetry action
router.post('/action', async (req, res, next) => {
  try {
    const { actionType, taskContext } = req.body;
    await telemetry.logRecommendationAction(actionType, taskContext);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

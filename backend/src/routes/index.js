const router = require('express').Router();

router.use('/auth', require('./auth.routes'));
router.use('/tasks', require('./task.routes'));
router.use('/ai', require('./ai.routes'));
router.use('/daily-plans', require('./dailyPlan.routes'));

module.exports = router;

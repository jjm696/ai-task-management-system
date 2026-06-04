const router = require('express').Router();

const verifyToken = require('../middleware/verifyToken');
const ctrl = require('../controllers/dailyPlan.controller');

router.use(verifyToken);

router.get('/', ctrl.getPlan);
router.post('/', ctrl.createPlan);
router.post('/items', ctrl.addItem);
router.put('/items/:id', ctrl.updateItem);
router.delete('/items/:id', ctrl.removeItem);
router.post('/generate', ctrl.generatePlan);

module.exports = router;

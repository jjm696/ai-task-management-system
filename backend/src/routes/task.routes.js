const router = require('express').Router();

const ctrl = require('../controllers/task.controller');
const verifyToken = require('../middleware/verifyToken');

// 整个路由组都需要登录
router.use(verifyToken);

// 注意：静态路径 /statistics 必须放在 /:id 之前，否则会被参数路由拦截
router.get('/statistics', ctrl.statistics);

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.get('/:id', ctrl.detail);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;

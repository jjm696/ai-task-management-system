const router = require('express').Router();

const ctrl = require('../controllers/auth.controller');
const verifyToken = require('../middleware/verifyToken');

// 注册
router.post('/register', ctrl.register);

// 登录
router.post('/login', ctrl.login);

// 获取当前用户（需要 token）
router.get('/me', verifyToken, ctrl.me);

module.exports = router;

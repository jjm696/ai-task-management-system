/**
 * verifyToken.js — JWT 认证中间件
 *
 * 用法：
 *   const verifyToken = require('../middleware/verifyToken');
 *   router.get('/me', verifyToken, controller.me);
 *
 * 行为：
 *   1. 从请求头 Authorization: Bearer <token> 中提取 token
 *   2. 使用 JWT_SECRET 校验签名 / 过期时间
 *   3. 校验通过：将 payload 挂到 req.user = { id, email }
 *   4. 校验失败：直接返回 401
 */
const jwt = require('jsonwebtoken');

module.exports = function verifyToken(req, res, next) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return res.status(401).json({ code: 401, message: '未登录或 token 缺失' });
  }

  const token = match[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // 标准 payload 应包含 { id, email, iat, exp }
    req.user = { id: payload.id, email: payload.email };
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'token 已过期，请重新登录' : 'token 无效';
    return res.status(401).json({ code: 401, message: msg });
  }
};

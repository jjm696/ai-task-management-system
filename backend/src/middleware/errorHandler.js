/**
 * 全局错误处理中间件
 * 业务代码可通过 throw new Error('...') 或 next(err) 抛错
 * 推荐错误对象上挂载 status 字段以指定 HTTP 状态码
 */
module.exports = function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  if (status >= 500) {
    console.error('[errorHandler]', err);
  }

  res.status(status).json({
    code: status,
    message,
    ...(process.env.NODE_ENV !== 'production' && err.stack ? { stack: err.stack } : {}),
  });
};

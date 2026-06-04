import request from './request';

/**
 * 后端统一返回结构：{ code, message, data }
 * request.js 拦截器已经返回 res.data 整体，调用方再取 .data 字段
 */
export const login = (data) => request.post('/auth/login', data);
export const register = (data) => request.post('/auth/register', data);
export const getProfile = () => request.get('/auth/me');

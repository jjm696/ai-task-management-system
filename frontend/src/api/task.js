import request from './request';

export const listTasks = (params) => request.get('/tasks', { params });
export const createTask = (data) => request.post('/tasks', data);
export const getTask = (id) => request.get(`/tasks/${id}`);
export const updateTask = (id, data) => request.put(`/tasks/${id}`, data);
export const deleteTask = (id) => request.delete(`/tasks/${id}`);

/** 获取仪表盘统计：状态分组 + 近 7 天完成趋势 */
export const getStatistics = () => request.get('/tasks/statistics');

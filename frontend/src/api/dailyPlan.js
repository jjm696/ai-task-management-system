import request from './request';

export const getDailyPlan = (date) =>
  request.get('/daily-plans', { params: date ? { date } : {} });

export const createDailyPlan = (data) =>
  request.post('/daily-plans', data);

export const addDailyPlanItem = (data) =>
  request.post('/daily-plans/items', data);

export const updateDailyPlanItem = (id, data) =>
  request.put(`/daily-plans/items/${id}`, data);

export const removeDailyPlanItem = (id) =>
  request.delete(`/daily-plans/items/${id}`);

export const generateDailyPlan = (data = {}) =>
  request.post('/daily-plans/generate', data);

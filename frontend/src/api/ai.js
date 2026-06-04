import request from './request';

/** 智能任务拆解：传一句话描述，返回子任务列表 */
export const taskBreakdown = (userInput) =>
  request.post('/ai/task-breakdown', { userInput });

/**
 * 周报生成
 * @param {{ startDate?: string, endDate?: string }} payload  ISO 字符串，可省略走默认范围（本周一→今天）
 */
export const generateWeeklyReport = (payload = {}) =>
  request.post('/ai/weekly-report', payload);

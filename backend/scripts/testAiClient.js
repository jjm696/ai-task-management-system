/**
 * 简单的连通性 & JSON 输出测试脚本
 * 使用方式：
 *   1. 在 backend/ 目录复制 .env.example 为 .env，填写真实 API_KEY 和 BASE_URL
 *   2. cd backend && npm install
 *   3. npm run test:ai
 */
require('dotenv').config();

const { chat, chatJSON } = require('../utils/aiClient');

(async () => {
  console.log('===== [1] 普通对话测试 =====');
  try {
    const text = await chat([
      { role: 'system', content: '你是一个简洁的助手。' },
      { role: 'user', content: '用一句话介绍你自己。' },
    ]);
    console.log('模型输出：', text);
  } catch (e) {
    console.error('普通对话失败：', e.message);
  }

  console.log('\n===== [2] JSON 输出测试 =====');
  try {
    const json = await chatJSON(
      [
        { role: 'system', content: '你是任务拆解助手。' },
        {
          role: 'user',
          content:
            '把"准备明天下午3点的客户演示会议"拆解为子任务，返回 JSON：{"subtasks":[{"title":string,"priority":"高"|"中"|"低","estimatedHours":number}]}',
        },
      ],
      {
        validator: (obj) => {
          if (!obj || !Array.isArray(obj.subtasks)) return 'subtasks 必须是数组';
          for (const s of obj.subtasks) {
            if (typeof s.title !== 'string') return 'title 必须是字符串';
            if (!['高', '中', '低'].includes(s.priority)) return 'priority 非法';
            if (typeof s.estimatedHours !== 'number') return 'estimatedHours 必须是数字';
          }
          return true;
        },
      }
    );
    console.log('解析后的 JSON：');
    console.dir(json, { depth: null });
  } catch (e) {
    console.error('JSON 输出失败：', e.message);
  }
})();

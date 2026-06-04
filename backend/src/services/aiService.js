/**
 * aiService.js — AI 业务封装层
 *
 * 职责：
 *   - 维护提示词模板
 *   - 调用底层 aiClient
 *   - 对模型返回 JSON 做结构化校验，无效时本层最多再重试 2 次
 *     （注意：aiClient 自身已含网络层的指数退避重试）
 *   - 进行业务字段归一化（如中文优先级 → 枚举值）
 */
const { chat, chatJSON } = require('../../utils/aiClient');

// ---------- 常量 ----------
const PRIORITY_MAP_CN_TO_EN = { 高: 'HIGH', 中: 'MEDIUM', 低: 'LOW' };
const VALID_CN_PRIORITY = new Set(['高', '中', '低']);

// ---------- 提示词模板 ----------
function buildBreakdownPrompt(userInput) {
  return `你是一个任务管理专家。将用户的一句话任务描述拆解为 3-5 个子任务。
每个子任务必须包含：标题、优先级（高/中/低）、预估时间（小时）。
用户输入：${userInput}
请只返回 JSON 格式，不要有其他文字：
{"subtasks": [{"title": "string", "priority": "string", "estimatedHours": number}]}`;
}

// ---------- 工具：通用 Claude 调用 ----------
/**
 * 通用 Claude 调用（薄封装）
 * @param {string} prompt   用户消息（user role）
 * @param {Object} [opts]
 * @param {string} [opts.system]  可选 system 提示词
 * @returns {Promise<string>}     模型输出文本
 */
async function callClaudeAPI(prompt, opts = {}) {
  const messages = [];
  if (opts.system) messages.push({ role: 'system', content: opts.system });
  messages.push({ role: 'user', content: prompt });
  return chat(messages, opts);
}

// ---------- 校验：拆解结果 ----------
function validateBreakdown(obj) {
  if (!obj || typeof obj !== 'object') return 'JSON 根必须是对象';
  if (!Array.isArray(obj.subtasks)) return '缺少 subtasks 数组';
  if (obj.subtasks.length < 1) return 'subtasks 不能为空';
  if (obj.subtasks.length > 10) return 'subtasks 数量异常';

  for (const [i, s] of obj.subtasks.entries()) {
    if (!s || typeof s !== 'object') return `第 ${i + 1} 项不是对象`;
    if (typeof s.title !== 'string' || s.title.trim().length === 0)
      return `第 ${i + 1} 项 title 非法`;
    if (typeof s.priority !== 'string' || !VALID_CN_PRIORITY.has(s.priority))
      return `第 ${i + 1} 项 priority 必须是 高/中/低`;
    if (typeof s.estimatedHours !== 'number' || s.estimatedHours <= 0 || s.estimatedHours > 100)
      return `第 ${i + 1} 项 estimatedHours 非法`;
  }
  return true;
}

/** 归一化：中文优先级 → 枚举值，便于前端直接落库 */
function normalizeBreakdown(obj) {
  return {
    subtasks: obj.subtasks.map((s) => ({
      title: s.title.trim(),
      priority: s.priority,                                  // 保留中文给 UI 展示
      priorityEnum: PRIORITY_MAP_CN_TO_EN[s.priority],       // 同时给出枚举供落库
      estimatedHours: Number(s.estimatedHours),
    })),
  };
}

// ---------- 主入口：任务拆解 ----------
/**
 * @param {string} userInput  用户一句话描述
 * @returns {Promise<{subtasks: Array}>}
 */
async function taskBreakdown(userInput) {
  if (typeof userInput !== 'string' || userInput.trim().length === 0) {
    const err = new Error('userInput 不能为空');
    err.status = 400;
    throw err;
  }

  const prompt = buildBreakdownPrompt(userInput.trim());

  // 本层最多再尝试 3 次（首次 + 2 次重试），每次都做 JSON 校验
  const MAX_ATTEMPTS = 3;
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const json = await chatJSON(
        [
          { role: 'system', content: '你是一个严谨的任务管理专家，只输出 JSON。' },
          { role: 'user', content: prompt },
        ],
        { validator: validateBreakdown }
      );
      return normalizeBreakdown(json);
    } catch (e) {
      lastErr = e;
      console.warn(`[aiService.taskBreakdown] 第 ${attempt}/${MAX_ATTEMPTS} 次失败: ${e.message}`);
      if (attempt === MAX_ATTEMPTS) break;
    }
  }

  const err = new Error(`AI 任务拆解失败：${lastErr?.message || '未知错误'}`);
  err.status = 502;
  err.cause = lastErr;
  throw err;
}

// ==================================================
// 周报生成
// ==================================================

const PRIORITY_CN = { HIGH: '高', MEDIUM: '中', LOW: '低' };

/**
 * 将任务列表格式化为提示词中的 ${taskList} 文本
 */
function formatTasksForPrompt(tasks) {
  if (!tasks || tasks.length === 0) return '（无）';
  return tasks
    .map((t, i) => {
      const parts = [
        `${i + 1}. ${t.title}`,
        `优先级：${PRIORITY_CN[t.priority] || t.priority}`,
      ];
      if (t.estimatedHours) parts.push(`预估工时：${t.estimatedHours}小时`);
      if (t.description) parts.push(`描述：${t.description.replace(/\s+/g, ' ').slice(0, 200)}`);
      if (t.completedAt || t.updatedAt) {
        const d = new Date(t.completedAt || t.updatedAt);
        parts.push(`完成时间：${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      }
      return parts.join('，');
    })
    .join('\n');
}

function buildWeeklyReportPrompt(taskListText) {
  return `根据我本周完成的以下任务：
${taskListText}

生成一份面向技术主管的周报。
格式：
1. 本周核心产出（3-5点，每点一句话）
2. 遇到的问题与解决
3. 下周计划
语气专业简洁。请输出 Markdown 格式。`;
}

/**
 * @param {Array} tasks  已完成任务列表（来自 Prisma 查询）
 * @returns {Promise<string>}  Markdown 文本
 */
async function weeklyReport(tasks) {
  const taskListText = formatTasksForPrompt(tasks);
  const prompt = buildWeeklyReportPrompt(taskListText);

  // 周报是自由文本，无需 JSON 校验。提高 max_tokens 避免被截断。
  const markdown = await callClaudeAPI(prompt, {
    system: '你是一位高效的技术经理助理，擅长撰写简洁专业的中文周报。',
    maxTokens: 1500,
    temperature: 0.5,
  });
  return markdown.trim();
}

// ==================================================
// 每日计划生成
// ==================================================

function formatTasksForDailyPlan(tasks) {
  return tasks
    .map((t) => {
      const due = t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : '无';
      const hours = t.estimatedHours ? `${t.estimatedHours}小时` : '未估算';
      const parent = t.parentId ? `子任务，parentId=${t.parentId}` : '主任务/独立任务';
      return [
        `id=${t.id}`,
        `标题=${t.title}`,
        `状态=${t.status}`,
        `优先级=${PRIORITY_CN[t.priority] || t.priority}`,
        `截止=${due}`,
        `预估=${hours}`,
        `类型=${parent}`,
      ].join('；');
    })
    .join('\n');
}

function buildDailyPlanPrompt(tasks, opts) {
  const taskText = formatTasksForDailyPlan(tasks);
  return `今天日期：${opts.date}
请从下面未完成任务中选择最多 ${opts.limit} 个，生成一个务实的今日执行计划。

选择原则：
1. 优先选择高优先级、临近截止、有明确产出的任务。
2. 避免一天安排过多任务。
3. 子任务优先于过大的主任务。
4. reason 要说明为什么今天做。

候选任务：
${taskText}

请只返回 JSON：
{
  "summary": "一句话今日重点",
  "items": [
    { "taskId": 1, "reason": "string" }
  ]
}`;
}

function validateDailyPlan(obj) {
  if (!obj || typeof obj !== 'object') return 'JSON 根必须是对象';
  if (typeof obj.summary !== 'string' || obj.summary.trim().length === 0) return 'summary 必须是字符串';
  if (!Array.isArray(obj.items)) return 'items 必须是数组';
  if (obj.items.length === 0) return 'items 不能为空';
  if (obj.items.length > 12) return 'items 数量过多';
  for (const [i, item] of obj.items.entries()) {
    if (!item || typeof item !== 'object') return `第 ${i + 1} 项不是对象`;
    if (!Number.isInteger(item.taskId) || item.taskId <= 0) return `第 ${i + 1} 项 taskId 非法`;
    if (typeof item.reason !== 'string' || item.reason.trim().length === 0) return `第 ${i + 1} 项 reason 非法`;
  }
  return true;
}

async function dailyPlan(tasks, opts = {}) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    const err = new Error('没有可用于生成每日计划的任务');
    err.status = 400;
    throw err;
  }

  const limit = opts.limit || 6;
  const prompt = buildDailyPlanPrompt(tasks, { ...opts, limit });
  const allowedIds = new Set(tasks.map((t) => t.id));

  const parsed = await chatJSON(
    [
      { role: 'system', content: '你是一个严格、务实的任务规划助手，只输出 JSON。' },
      { role: 'user', content: prompt },
    ],
    { validator: validateDailyPlan }
  );

  const seen = new Set();
  const items = parsed.items
    .filter((item) => allowedIds.has(item.taskId))
    .filter((item) => {
      if (seen.has(item.taskId)) return false;
      seen.add(item.taskId);
      return true;
    })
    .slice(0, limit)
    .map((item) => ({
      taskId: item.taskId,
      reason: item.reason.trim(),
    }));

  if (items.length === 0) {
    const err = new Error('AI 未返回有效任务 ID');
    err.status = 502;
    throw err;
  }

  return {
    summary: parsed.summary.trim(),
    items,
  };
}

module.exports = {
  callClaudeAPI,
  taskBreakdown,
  weeklyReport,
  dailyPlan,
  // 导出仅供测试
  _buildBreakdownPrompt: buildBreakdownPrompt,
  _buildWeeklyReportPrompt: buildWeeklyReportPrompt,
  _validateBreakdown: validateBreakdown,
  _formatTasksForPrompt: formatTasksForPrompt,
};

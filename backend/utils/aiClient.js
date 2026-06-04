/**
 * aiClient.js
 * --------------------------------------------------
 * 封装对「兼容 OpenAI 协议」的大模型 API 的调用（用于接入 Claude 国内中转服务）。
 *
 * 特性：
 *   1. 通过环境变量配置 API_KEY / BASE_URL / MODEL，支持任意国内中转商
 *   2. 统一的 chat() 方法，输入 messages 数组，返回字符串内容
 *   3. chatJSON() 方法：要求模型返回 JSON，并自动解析 + 校验
 *   4. 内置指数退避重试（默认最多 3 次）
 *   5. 详细错误日志，便于排查中转服务问题
 */

const axios = require('axios');

// ---------- 配置读取 ----------
const CONFIG = {
  apiKey: process.env.AI_API_KEY,
  baseURL: (process.env.AI_BASE_URL || '').replace(/\/+$/, ''), // 去掉末尾斜杠
  model: process.env.AI_MODEL || 'claude-3-5-sonnet-20241022',
  timeout: parseInt(process.env.AI_TIMEOUT_MS || '60000', 10),
  maxRetries: parseInt(process.env.AI_MAX_RETRIES || '3', 10),
  retryBaseDelay: parseInt(process.env.AI_RETRY_BASE_DELAY_MS || '1000', 10),
  temperature: parseFloat(process.env.AI_TEMPERATURE || '0.3'),
  maxTokens: parseInt(process.env.AI_MAX_TOKENS || '2048', 10),
};

// ---------- 工具函数 ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 判断错误是否值得重试
 *  - 网络错误 / 超时 / 5xx / 429 视为可重试
 *  - 4xx（除 429）通常是参数或鉴权问题，不重试
 */
function isRetryableError(err) {
  if (!err.response) return true; // 网络层错误（ECONNRESET / ETIMEDOUT 等）
  const status = err.response.status;
  if (status === 429) return true;
  if (status >= 500 && status < 600) return true;
  return false;
}

/**
 * 从兼容 OpenAI 协议的返回结构中提取文本内容
 */
function extractContent(data) {
  if (!data || !Array.isArray(data.choices) || data.choices.length === 0) {
    throw new Error('AI 响应缺少 choices 字段');
  }
  const msg = data.choices[0].message;
  if (!msg || typeof msg.content !== 'string') {
    throw new Error('AI 响应缺少 message.content 字段');
  }
  return msg.content;
}

/**
 * 从文本中提取 JSON 对象/数组
 *   - 优先尝试直接 JSON.parse
 *   - 若失败，则在文本中查找首个 { ... } 或 [ ... ] 片段（兼容模型偶尔输出的 markdown 代码块）
 */
function parseJSONFromText(text) {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (_) {
    // 退化方案：抓取首个 JSON 片段
    const match = cleaned.match(/[\[{][\s\S]*[\]}]/);
    if (!match) {
      throw new Error(`无法从模型响应中解析出 JSON。原始内容：${text.slice(0, 300)}`);
    }
    try {
      return JSON.parse(match[0]);
    } catch (e) {
      throw new Error(`JSON 解析失败：${e.message}。原始内容：${text.slice(0, 300)}`);
    }
  }
}

// ---------- axios 实例 ----------
function buildAxios() {
  if (!CONFIG.apiKey) {
    throw new Error('AI_API_KEY 未配置，请检查 .env 文件');
  }
  if (!CONFIG.baseURL) {
    throw new Error('AI_BASE_URL 未配置，请检查 .env 文件');
  }
  return axios.create({
    baseURL: CONFIG.baseURL,
    timeout: CONFIG.timeout,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CONFIG.apiKey}`,
    },
  });
}

/**
 * 核心 chat 方法
 * @param {Array<{role:'system'|'user'|'assistant', content:string}>} messages
 * @param {Object} [options]
 * @param {string} [options.model]
 * @param {number} [options.temperature]
 * @param {number} [options.maxTokens]
 * @param {boolean} [options.responseFormatJSON] - 若 true，则在请求中加入 response_format: { type: 'json_object' }
 * @returns {Promise<string>} 模型输出文本
 */
async function chat(messages, options = {}) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('messages 必须是非空数组');
  }

  const client = buildAxios();
  const payload = {
    model: options.model || CONFIG.model,
    messages,
    temperature: options.temperature ?? CONFIG.temperature,
    max_tokens: options.maxTokens ?? CONFIG.maxTokens,
  };
  if (options.responseFormatJSON) {
    payload.response_format = { type: 'json_object' };
  }

  let lastErr;
  for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
    try {
      const res = await client.post('/chat/completions', payload);
      return extractContent(res.data);
    } catch (err) {
      lastErr = err;
      const status = err.response?.status;
      const body = err.response?.data;
      const retryable = isRetryableError(err);

      console.error(
        `[aiClient] 第 ${attempt}/${CONFIG.maxRetries} 次调用失败 ` +
          `status=${status || 'N/A'} retryable=${retryable} msg=${err.message}` +
          (body ? ` body=${JSON.stringify(body).slice(0, 300)}` : '')
      );

      if (!retryable || attempt === CONFIG.maxRetries) break;

      // 指数退避：base * 2^(attempt-1) + 抖动
      const delay = CONFIG.retryBaseDelay * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 300);
      await sleep(delay);
    }
  }

  // 抛出更友好的错误
  const status = lastErr?.response?.status;
  const body = lastErr?.response?.data;
  const e = new Error(
    `AI 接口调用失败（已重试 ${CONFIG.maxRetries} 次）：${lastErr?.message}` +
      (status ? ` [HTTP ${status}]` : '') +
      (body ? ` 详情：${JSON.stringify(body).slice(0, 300)}` : '')
  );
  e.cause = lastErr;
  throw e;
}

/**
 * 调用模型并要求返回 JSON，自动解析与校验
 * @param {Array} messages
 * @param {Object} [options]
 * @param {(obj:any)=>true|string} [options.validator] - 自定义校验器，返回 true 表示通过，返回字符串表示错误信息
 * @returns {Promise<any>} 解析后的 JSON 对象
 */
async function chatJSON(messages, options = {}) {
  // 在 system 提示尾部增强 JSON 输出约束（防止模型输出多余文本）
  const enhanced = [...messages];
  enhanced.push({
    role: 'system',
    content: '请严格只输出一个合法的 JSON 对象，不要包含任何解释性文字、不要使用 markdown 代码块。',
  });

  const raw = await chat(enhanced, { ...options, responseFormatJSON: true });
  const parsed = parseJSONFromText(raw);

  if (typeof options.validator === 'function') {
    const ok = options.validator(parsed);
    if (ok !== true) {
      throw new Error(`AI 返回 JSON 校验未通过：${ok}`);
    }
  }
  return parsed;
}

module.exports = {
  chat,
  chatJSON,
  _config: CONFIG, // 导出仅供调试
};

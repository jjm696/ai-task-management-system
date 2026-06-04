const router = require('express').Router();

const verifyToken = require('../middleware/verifyToken');
const aiService = require('../services/aiService');

// AI 接口需登录
router.use(verifyToken);

/**
 * POST /api/ai/task-breakdown
 * body: { userInput: string }
 * resp: { code:0, data: { subtasks: [{ title, priority, priorityEnum, estimatedHours }] } }
 */
router.post('/task-breakdown', async (req, res, next) => {
  try {
    const { userInput } = req.body || {};
    const data = await aiService.taskBreakdown(userInput);
    res.json({ code: 0, data });
  } catch (err) {
    next(err);
  }
});

// 兼容旧路径
router.post('/breakdown', async (req, res, next) => {
  try {
    const { userInput } = req.body || {};
    const data = await aiService.taskBreakdown(userInput);
    res.json({ code: 0, data });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/ai/weekly-report
 * body: { startDate?: ISOString, endDate?: ISOString }
 *   默认：本周一 00:00 → 今天 23:59
 * 行为：
 *   1. 查询当前用户在 [startDate, endDate] 区间内 status=DONE 的任务（按 completedAt 排序）
 *   2. 调用 AI 生成 Markdown 周报
 * resp: { code, data: { markdown, taskCount, startDate, endDate, tasks } }
 */
const prisma = require('../prisma');

function getDefaultRange() {
  const now = new Date();
  const day = now.getDay() === 0 ? 7 : now.getDay(); // 周日视为 7
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day - 1));
  monday.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start: monday, end };
}

function parseDate(v, fallback) {
  if (!v) return fallback;
  const d = new Date(v);
  return isNaN(d.getTime()) ? fallback : d;
}

router.post('/weekly-report', async (req, res, next) => {
  try {
    const def = getDefaultRange();
    const start = parseDate(req.body?.startDate, def.start);
    const end = parseDate(req.body?.endDate, def.end);

    if (start > end) {
      return res.status(400).json({ code: 400, message: 'startDate 不能晚于 endDate' });
    }

    const tasks = await prisma.task.findMany({
      where: {
        userId: req.user.id,
        status: 'DONE',
        completedAt: { gte: start, lte: end },
      },
      orderBy: { completedAt: 'asc' },
    });

    const markdown = await aiService.weeklyReport(tasks);

    res.json({
      code: 0,
      data: {
        markdown,
        taskCount: tasks.length,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        tasks: tasks.map((t) => ({
          id: t.id,
          title: t.title,
          priority: t.priority,
          estimatedHours: t.estimatedHours,
          completedAt: t.completedAt,
          updatedAt: t.updatedAt,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

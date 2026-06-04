const { z } = require('zod');
const prisma = require('../prisma');
const aiService = require('../services/aiService');

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式必须是 YYYY-MM-DD');

const getPlanSchema = z.object({
  date: dateSchema.optional(),
});

const createPlanSchema = z.object({
  date: dateSchema,
  summary: z.string().max(5000).optional().nullable(),
});

const addItemSchema = z.object({
  date: dateSchema,
  taskId: z.coerce.number().int().positive(),
  note: z.string().max(5000).optional().nullable(),
});

const updateItemSchema = z.object({
  order: z.coerce.number().int().min(0).optional(),
  note: z.string().max(5000).optional().nullable(),
});

const generateSchema = z.object({
  date: dateSchema.optional(),
  limit: z.coerce.number().int().min(1).max(12).default(6),
});

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseDateKey(key) {
  // Prisma maps MySQL DATE to a JS Date at UTC midnight. Avoid timezone offsets here,
  // otherwise 2026-06-04 in Asia/Shanghai becomes 2026-06-03T16:00Z and misses records.
  return new Date(`${key}T00:00:00.000Z`);
}

function handleZod(err, res) {
  if (err instanceof z.ZodError) {
    res.status(400).json({ code: 400, message: err.errors[0]?.message || '参数错误' });
    return true;
  }
  return false;
}

async function findOrCreatePlan(userId, dateKey, summary) {
  const date = parseDateKey(dateKey);
  return prisma.dailyPlan.upsert({
    where: { userId_date: { userId, date } },
    update: summary !== undefined ? { summary: summary ?? null } : {},
    create: { userId, date, summary: summary ?? null },
  });
}

function includeItems() {
  return {
    items: {
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      include: { task: true },
    },
  };
}

async function getPlan(req, res, next) {
  try {
    const q = getPlanSchema.parse(req.query);
    const dateKey = q.date || todayKey();
    const plan = await findOrCreatePlan(req.user.id, dateKey);
    const full = await prisma.dailyPlan.findUnique({
      where: { id: plan.id },
      include: includeItems(),
    });
    res.json({ code: 0, data: full });
  } catch (err) {
    if (handleZod(err, res)) return;
    next(err);
  }
}

async function createPlan(req, res, next) {
  try {
    const data = createPlanSchema.parse(req.body);
    const plan = await findOrCreatePlan(req.user.id, data.date, data.summary);
    const full = await prisma.dailyPlan.findUnique({
      where: { id: plan.id },
      include: includeItems(),
    });
    res.status(201).json({ code: 0, message: '每日计划已创建', data: full });
  } catch (err) {
    if (handleZod(err, res)) return;
    next(err);
  }
}

async function addItem(req, res, next) {
  try {
    const data = addItemSchema.parse(req.body);
    const task = await prisma.task.findFirst({
      where: { id: data.taskId, userId: req.user.id },
    });
    if (!task) return res.status(404).json({ code: 404, message: '任务不存在' });

    const plan = await findOrCreatePlan(req.user.id, data.date);
    const maxOrder = await prisma.dailyPlanItem.aggregate({
      where: { dailyPlanId: plan.id },
      _max: { order: true },
    });

    const item = await prisma.dailyPlanItem.upsert({
      where: { dailyPlanId_taskId: { dailyPlanId: plan.id, taskId: task.id } },
      update: {
        note: data.note ?? undefined,
        statusSnapshot: task.status,
      },
      create: {
        dailyPlanId: plan.id,
        taskId: task.id,
        note: data.note ?? null,
        statusSnapshot: task.status,
        order: (maxOrder._max.order ?? 0) + 1,
      },
      include: { task: true },
    });

    res.status(201).json({ code: 0, message: '已加入今日计划', data: item });
  } catch (err) {
    if (handleZod(err, res)) return;
    next(err);
  }
}

async function updateItem(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ code: 400, message: '非法的计划项 ID' });

    const existing = await prisma.dailyPlanItem.findFirst({
      where: { id, dailyPlan: { userId: req.user.id } },
    });
    if (!existing) return res.status(404).json({ code: 404, message: '计划项不存在' });

    const data = updateItemSchema.parse(req.body);
    const item = await prisma.dailyPlanItem.update({
      where: { id },
      data: {
        ...(data.order !== undefined ? { order: data.order } : {}),
        ...(data.note !== undefined ? { note: data.note } : {}),
      },
      include: { task: true },
    });
    res.json({ code: 0, message: '计划项已更新', data: item });
  } catch (err) {
    if (handleZod(err, res)) return;
    next(err);
  }
}

async function removeItem(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ code: 400, message: '非法的计划项 ID' });

    const existing = await prisma.dailyPlanItem.findFirst({
      where: { id, dailyPlan: { userId: req.user.id } },
    });
    if (!existing) return res.status(404).json({ code: 404, message: '计划项不存在' });

    await prisma.dailyPlanItem.delete({ where: { id } });
    res.json({ code: 0, message: '已移出每日计划' });
  } catch (err) {
    next(err);
  }
}

async function generatePlan(req, res, next) {
  try {
    const data = generateSchema.parse(req.body || {});
    const dateKey = data.date || todayKey();
    const tasks = await prisma.task.findMany({
      where: {
        userId: req.user.id,
        status: { not: 'DONE' },
      },
      orderBy: [{ dueDate: 'asc' }, { priority: 'asc' }, { createdAt: 'desc' }],
      take: 30,
    });

    if (tasks.length === 0) {
      return res.status(400).json({ code: 400, message: '暂无未完成任务可用于生成今日计划' });
    }

    const aiPlan = await aiService.dailyPlan(tasks, { limit: data.limit, date: dateKey });
    const selectedIds = aiPlan.items.map((item) => item.taskId);
    const validTasks = new Map(tasks.map((task) => [task.id, task]));
    const plan = await findOrCreatePlan(req.user.id, dateKey, aiPlan.summary);

    let created = 0;
    for (const [index, item] of aiPlan.items.entries()) {
      const task = validTasks.get(item.taskId);
      if (!task) continue;
      await prisma.dailyPlanItem.upsert({
        where: { dailyPlanId_taskId: { dailyPlanId: plan.id, taskId: task.id } },
        update: {
          order: index + 1,
          note: item.reason || null,
          statusSnapshot: task.status,
        },
        create: {
          dailyPlanId: plan.id,
          taskId: task.id,
          order: index + 1,
          note: item.reason || null,
          statusSnapshot: task.status,
        },
      });
      created += 1;
    }

    const full = await prisma.dailyPlan.findUnique({
      where: { id: plan.id },
      include: includeItems(),
    });

    res.json({
      code: 0,
      message: `AI 已生成 ${created} 个今日任务`,
      data: { ...full, selectedTaskIds: selectedIds },
    });
  } catch (err) {
    if (handleZod(err, res)) return;
    next(err);
  }
}

module.exports = {
  getPlan,
  createPlan,
  addItem,
  updateItem,
  removeItem,
  generatePlan,
};

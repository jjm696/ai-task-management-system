/**
 * task.controller.js — 任务 CRUD 控制器
 *
 * 所有接口均需先经过 verifyToken 中间件，
 * 通过 req.user.id 隔离不同用户的数据。
 */
const { z } = require('zod');
const prisma = require('../prisma');

// ---------- 枚举 ----------
const PRIORITY = ['HIGH', 'MEDIUM', 'LOW'];
const STATUS = ['PENDING', 'IN_PROGRESS', 'DONE'];

// ---------- 校验 ----------
const createSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题过长'),
  description: z.string().max(5000).optional().nullable(),
  priority: z.enum(PRIORITY).optional(),
  status: z.enum(STATUS).optional(),
  estimatedHours: z.coerce.number().positive('预估工时必须大于 0').max(10000, '预估工时过大').optional().nullable(),
  aiGenerated: z.boolean().optional(),
  sourcePrompt: z.string().max(5000).optional().nullable(),
  parentId: z.coerce.number().int().positive('父任务 ID 非法').optional().nullable(),
  dueDate: z
    .union([z.string().datetime({ offset: true }), z.string().length(0), z.null()])
    .optional()
    // 仅当字段被显式传入时才参与赋值；undefined 保持 undefined（让 update 时不动该字段）
    .transform((v) => (v === undefined ? undefined : v ? new Date(v) : null)),
  completedAt: z
    .union([z.string().datetime({ offset: true }), z.string().length(0), z.null()])
    .optional()
    .transform((v) => (v === undefined ? undefined : v ? new Date(v) : null)),
});

const updateSchema = createSchema.partial();

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  status: z.enum(STATUS).optional(),
  priority: z.enum(PRIORITY).optional(),
  keyword: z.string().trim().optional(),
});

// ---------- 工具 ----------
function handleZod(err, res) {
  if (err instanceof z.ZodError) {
    res.status(400).json({ code: 400, message: err.errors[0]?.message || '参数错误' });
    return true;
  }
  return false;
}

/** 找到任务并校验所属，找不到/越权返回 null 并已写入 res */
async function findOwnedTask(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    res.status(400).json({ code: 400, message: '非法的任务 ID' });
    return null;
  }
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task || task.userId !== req.user.id) {
    res.status(404).json({ code: 404, message: '任务不存在' });
    return null;
  }
  return task;
}

async function assertOwnedParent(parentId, userId, res, selfId) {
  if (parentId === undefined || parentId === null) return parentId ?? null;
  if (selfId && parentId === selfId) {
    res.status(400).json({ code: 400, message: '父任务不能指向自身' });
    return undefined;
  }
  const parent = await prisma.task.findFirst({ where: { id: parentId, userId } });
  if (!parent) {
    res.status(400).json({ code: 400, message: '父任务不存在或无权访问' });
    return undefined;
  }
  return parentId;
}

function getCompletedAtForCreate(status, completedAt) {
  if (completedAt !== undefined) return completedAt;
  return status === 'DONE' ? new Date() : null;
}

function getCompletedAtForUpdate(existing, data) {
  if (data.completedAt !== undefined) return data.completedAt;
  if (data.status === undefined) return undefined;
  if (data.status === 'DONE') return existing.completedAt || new Date();
  return null;
}

// ---------- Controllers ----------

/**
 * GET /api/tasks
 * query: page, pageSize, status, priority, keyword
 */
async function list(req, res, next) {
  try {
    const q = listSchema.parse(req.query);

    const where = {
      userId: req.user.id,
      ...(q.status ? { status: q.status } : {}),
      ...(q.priority ? { priority: q.priority } : {}),
      ...(q.keyword
        ? {
            OR: [
              { title: { contains: q.keyword } },
              { description: { contains: q.keyword } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy: [{ status: 'asc' }, { priority: 'asc' }, { createdAt: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      prisma.task.count({ where }),
    ]);

    res.json({
      code: 0,
      data: { items, total, page: q.page, pageSize: q.pageSize },
    });
  } catch (err) {
    if (handleZod(err, res)) return;
    next(err);
  }
}

/**
 * POST /api/tasks
 */
async function create(req, res, next) {
  try {
    const data = createSchema.parse(req.body);
    const parentId = await assertOwnedParent(data.parentId, req.user.id, res);
    if (parentId === undefined) return;
    const status = data.status ?? 'PENDING';
    const task = await prisma.task.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        priority: data.priority ?? 'MEDIUM',
        status,
        dueDate: data.dueDate ?? null,
        estimatedHours: data.estimatedHours ?? null,
        aiGenerated: data.aiGenerated ?? false,
        sourcePrompt: data.sourcePrompt ?? null,
        completedAt: getCompletedAtForCreate(status, data.completedAt),
        parentId,
        userId: req.user.id,
      },
    });
    res.status(201).json({ code: 0, message: '创建成功', data: task });
  } catch (err) {
    if (handleZod(err, res)) return;
    next(err);
  }
}

/**
 * GET /api/tasks/:id
 */
async function detail(req, res, next) {
  try {
    const task = await findOwnedTask(req, res);
    if (!task) return;
    res.json({ code: 0, data: task });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/tasks/:id
 */
async function update(req, res, next) {
  try {
    const existing = await findOwnedTask(req, res);
    if (!existing) return;

    const data = updateSchema.parse(req.body);
    const parentId =
      data.parentId !== undefined
        ? await assertOwnedParent(data.parentId, req.user.id, res, existing.id)
        : undefined;
    if (data.parentId !== undefined && parentId === undefined) return;
    const completedAt = getCompletedAtForUpdate(existing, data);
    const task = await prisma.task.update({
      where: { id: existing.id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
        ...(data.estimatedHours !== undefined ? { estimatedHours: data.estimatedHours } : {}),
        ...(data.aiGenerated !== undefined ? { aiGenerated: data.aiGenerated } : {}),
        ...(data.sourcePrompt !== undefined ? { sourcePrompt: data.sourcePrompt } : {}),
        ...(data.parentId !== undefined ? { parentId } : {}),
        ...(completedAt !== undefined ? { completedAt } : {}),
      },
    });
    res.json({ code: 0, message: '更新成功', data: task });
  } catch (err) {
    if (handleZod(err, res)) return;
    next(err);
  }
}

/**
 * DELETE /api/tasks/:id
 */
async function remove(req, res, next) {
  try {
    const existing = await findOwnedTask(req, res);
    if (!existing) return;
    await prisma.task.delete({ where: { id: existing.id } });
    res.json({ code: 0, message: '删除成功' });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tasks/statistics
 * 返回：
 *   - statusCounts: 各状态任务数量及总数
 *   - daily: 近 7 天（含今天）每日完成任务数（按日期升序，缺失日期补 0）
 */
async function statistics(req, res, next) {
  try {
    const userId = req.user.id;

    // === 1. 状态分组计数 ===
    const groups = await prisma.task.groupBy({
      by: ['status'],
      where: { userId },
      _count: { _all: true },
    });
    const statusCounts = { PENDING: 0, IN_PROGRESS: 0, DONE: 0, total: 0 };
    for (const g of groups) {
      statusCounts[g.status] = g._count._all;
      statusCounts.total += g._count._all;
    }

    // === 2. 近 7 天每日完成数 ===
    // 计算 7 天起点（今天 - 6 天的 00:00）
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const start = new Date(today);
    start.setDate(today.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    // 用 $queryRaw 按 DATE(completedAt) 聚合，避免后续编辑已完成任务导致统计日期漂移
    // 注意：Prisma 在 MySQL 下需使用 Prisma.sql 拼接以保证安全
    const rows = await prisma.$queryRaw`
      SELECT DATE(completedAt) AS date, COUNT(*) AS count
      FROM tasks
      WHERE userId = ${userId}
        AND status = 'DONE'
        AND completedAt >= ${start}
        AND completedAt <= ${today}
      GROUP BY DATE(completedAt)
      ORDER BY DATE(completedAt) ASC
    `;

    // 把查询结果转成 { 'YYYY-MM-DD': count } 便于查表
    const dateMap = {};
    for (const r of rows) {
      // r.date 可能是 Date 对象；count 可能是 BigInt（MySQL）
      const d = r.date instanceof Date ? r.date : new Date(r.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dateMap[key] = Number(r.count);
    }

    // 补齐 7 天
    const daily = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      daily.push({ date: key, count: dateMap[key] || 0 });
    }

    res.json({ code: 0, data: { statusCounts, daily } });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, detail, update, remove, statistics };

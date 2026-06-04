/**
 * auth.controller.js — 用户认证控制器
 *
 * 提供：
 *   - register(): 注册（bcrypt 加密密码）
 *   - login():    登录（签发 JWT，默认 7 天）
 *   - me():       获取当前登录用户信息
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');

const prisma = require('../prisma');

// ---------- 输入校验 ----------
const registerSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(6, '密码至少 6 位').max(64, '密码过长'),
  nickname: z.string().min(1, '昵称不能为空').max(50, '昵称过长'),
});

const loginSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(1, '密码不能为空'),
});

// ---------- 工具函数 ----------
function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

/** 剔除敏感字段（password）后返回 */
function safeUser(user) {
  if (!user) return null;
  const { password, ...rest } = user;
  return rest;
}

// ---------- Controllers ----------

/**
 * POST /api/auth/register
 * body: { email, password, nickname }
 */
async function register(req, res, next) {
  try {
    const data = registerSchema.parse(req.body);

    // 邮箱唯一性检查
    const exists = await prisma.user.findUnique({ where: { email: data.email } });
    if (exists) {
      return res.status(409).json({ code: 409, message: '该邮箱已被注册' });
    }

    // bcrypt 加密（salt rounds=10 在安全与性能间取得平衡）
    const hashed = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashed,
        nickname: data.nickname,
      },
    });

    const token = signToken(user);
    res.status(201).json({
      code: 0,
      message: '注册成功',
      data: { token, user: safeUser(user) },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ code: 400, message: err.errors[0]?.message || '参数错误' });
    }
    next(err);
  }
}

/**
 * POST /api/auth/login
 * body: { email, password }
 */
async function login(req, res, next) {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      return res.status(401).json({ code: 401, message: '邮箱或密码错误' });
    }

    const ok = await bcrypt.compare(data.password, user.password);
    if (!ok) {
      return res.status(401).json({ code: 401, message: '邮箱或密码错误' });
    }

    const token = signToken(user);
    res.json({
      code: 0,
      message: '登录成功',
      data: { token, user: safeUser(user) },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ code: 400, message: err.errors[0]?.message || '参数错误' });
    }
    next(err);
  }
}

/**
 * GET /api/auth/me
 * 需要登录（verifyToken 中间件）
 */
async function me(req, res, next) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }
    res.json({ code: 0, data: safeUser(user) });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, me };

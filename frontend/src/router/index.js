/**
 * 路由 + 全局守卫
 *
 * 守卫规则：
 *   - meta.requiresAuth=true：必须登录，否则跳 /login
 *   - 已登录访问 /login：跳到 /dashboard
 *   - 首次进入且有 token 但未拉取 profile：自动 fetchProfile（失败则清空 token 并跳 /login）
 */
import { createRouter, createWebHistory } from 'vue-router';
import { useUserStore } from '@/stores/user';

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录' },
  },
  {
    // 主布局：包含顶部 header + 导航
    path: '/',
    component: () => import('@/views/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: '/dashboard' },
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: '仪表盘', requiresAuth: true },
      },
      {
        path: 'tasks',
        name: 'Tasks',
        component: () => import('@/views/Tasks.vue'),
        meta: { title: '任务', requiresAuth: true },
      },
      {
        path: 'daily',
        name: 'DailyPlan',
        component: () => import('@/views/DailyPlan.vue'),
        meta: { title: '今日计划', requiresAuth: true },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  if (to.meta.title) document.title = `${to.meta.title} · TaskFlow`;

  const userStore = useUserStore();

  // 1. 有 token 但 profile 为空 → 拉取一次
  if (userStore.isLoggedIn && !userStore.profile) {
    try {
      await userStore.fetchProfile();
    } catch (_) {
      userStore.logout();
      if (to.path !== '/login') return { path: '/login', query: { redirect: to.fullPath } };
    }
  }

  // 2. 需要登录但未登录
  if (to.meta.requiresAuth && !userStore.isLoggedIn) {
    return { path: '/login', query: { redirect: to.fullPath } };
  }

  // 3. 已登录还想去登录页 → 直接跳工作台
  if (to.path === '/login' && userStore.isLoggedIn) {
    return { path: '/dashboard' };
  }
});

export default router;

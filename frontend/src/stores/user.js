/**
 * user.js — Pinia 用户状态管理
 *
 * 职责：
 *   - 持久化 token 到 localStorage
 *   - 暴露 login / register / fetchProfile / logout actions
 *   - 提供 isLoggedIn 衍生状态供路由守卫使用
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import * as authApi from '@/api/auth';

const TOKEN_KEY = 'taskflow_token';

export const useUserStore = defineStore('user', () => {
  // ----- state -----
  const token = ref(localStorage.getItem(TOKEN_KEY) || '');
  const profile = ref(null);

  // ----- getters -----
  const isLoggedIn = computed(() => !!token.value);

  // ----- internal -----
  function setToken(t) {
    token.value = t || '';
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  }

  // ----- actions -----

  /**
   * 登录
   * @param {{ email:string, password:string }} payload
   */
  async function login(payload) {
    const res = await authApi.login(payload);
    // 后端返回 { code, message, data: { token, user } }
    setToken(res.data.token);
    profile.value = res.data.user;
    return res.data.user;
  }

  /**
   * 注册（注册接口同样返回 token，直接登录态）
   */
  async function register(payload) {
    const res = await authApi.register(payload);
    setToken(res.data.token);
    profile.value = res.data.user;
    return res.data.user;
  }

  /**
   * 获取当前用户信息（用于刷新页面后恢复 profile）
   */
  async function fetchProfile() {
    if (!token.value) return null;
    const res = await authApi.getProfile();
    profile.value = res.data;
    return res.data;
  }

  /**
   * 退出登录
   */
  function logout() {
    setToken('');
    profile.value = null;
  }

  return {
    token,
    profile,
    isLoggedIn,
    login,
    register,
    fetchProfile,
    logout,
  };
});

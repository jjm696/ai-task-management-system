import axios from 'axios';
import { ElMessage } from 'element-plus';
import { useUserStore } from '@/stores/user';

const request = axios.create({
  baseURL: '/api',
  timeout: 60000,
});

// 请求拦截器：附加 token
request.interceptors.request.use((config) => {
  const userStore = useUserStore();
  if (userStore.token) {
    config.headers.Authorization = `Bearer ${userStore.token}`;
  }
  return config;
});

// 响应拦截器：统一错误提示
request.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const status = err.response?.status;
    const msg = err.response?.data?.message || err.message || '网络异常';

    if (status === 401) {
      const userStore = useUserStore();
      userStore.logout();
      if (location.pathname !== '/login') location.href = '/login';
    }

    ElMessage.error(msg);
    return Promise.reject(err);
  }
);

export default request;

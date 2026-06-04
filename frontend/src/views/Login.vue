<script setup>
/**
 * Login.vue — 登录 / 注册页（同一页面 Tab 切换）
 *
 * 特性：
 *   - Element Plus el-form 表单校验（邮箱格式 / 密码长度 / 昵称必填）
 *   - 调用 user store 的 login / register
 *   - 成功后根据 query.redirect 跳转，默认 /dashboard
 */
import { ref, reactive } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useUserStore } from '@/stores/user';

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();

const activeTab = ref('login');
const loading = ref(false);

// ---------- 表单数据 ----------
const loginForm = reactive({ email: '', password: '' });
const registerForm = reactive({ email: '', password: '', confirm: '', nickname: '' });

const loginFormRef = ref();
const registerFormRef = ref();

// ---------- 校验规则 ----------
const loginRules = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' },
  ],
};

const registerRules = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
  ],
  nickname: [
    { required: true, message: '请输入昵称', trigger: 'blur' },
    { max: 50, message: '昵称过长', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 64, message: '密码长度 6-64 位', trigger: 'blur' },
  ],
  confirm: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    {
      validator: (_, value, cb) =>
        value === registerForm.password ? cb() : cb(new Error('两次输入的密码不一致')),
      trigger: 'blur',
    },
  ],
};

// ---------- 提交 ----------
function redirectAfterAuth() {
  const target = route.query.redirect || '/dashboard';
  router.replace(target);
}

async function onLogin() {
  const valid = await loginFormRef.value?.validate().catch(() => false);
  if (!valid) return;
  loading.value = true;
  try {
    await userStore.login({ email: loginForm.email, password: loginForm.password });
    ElMessage.success('登录成功');
    redirectAfterAuth();
  } finally {
    loading.value = false;
  }
}

async function onRegister() {
  const valid = await registerFormRef.value?.validate().catch(() => false);
  if (!valid) return;
  loading.value = true;
  try {
    await userStore.register({
      email: registerForm.email,
      password: registerForm.password,
      nickname: registerForm.nickname,
    });
    ElMessage.success('注册成功，已自动登录');
    redirectAfterAuth();
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <el-card class="login-card" shadow="always">
      <div class="brand">
        <h1>TaskFlow</h1>
        <p>智能任务管理平台</p>
      </div>

      <el-tabs v-model="activeTab" stretch>
        <!-- 登录 -->
        <el-tab-pane label="登录" name="login">
          <el-form
            ref="loginFormRef"
            :model="loginForm"
            :rules="loginRules"
            label-position="top"
            @submit.prevent="onLogin"
          >
            <el-form-item label="邮箱" prop="email">
              <el-input v-model="loginForm.email" placeholder="you@example.com" clearable />
            </el-form-item>
            <el-form-item label="密码" prop="password">
              <el-input
                v-model="loginForm.password"
                type="password"
                placeholder="至少 6 位"
                show-password
                @keyup.enter="onLogin"
              />
            </el-form-item>
            <el-button
              type="primary"
              :loading="loading"
              style="width: 100%"
              @click="onLogin"
            >登 录</el-button>
          </el-form>
        </el-tab-pane>

        <!-- 注册 -->
        <el-tab-pane label="注册" name="register">
          <el-form
            ref="registerFormRef"
            :model="registerForm"
            :rules="registerRules"
            label-position="top"
            @submit.prevent="onRegister"
          >
            <el-form-item label="邮箱" prop="email">
              <el-input v-model="registerForm.email" placeholder="you@example.com" clearable />
            </el-form-item>
            <el-form-item label="昵称" prop="nickname">
              <el-input v-model="registerForm.nickname" placeholder="您的称呼" clearable />
            </el-form-item>
            <el-form-item label="密码" prop="password">
              <el-input v-model="registerForm.password" type="password" show-password />
            </el-form-item>
            <el-form-item label="确认密码" prop="confirm">
              <el-input
                v-model="registerForm.confirm"
                type="password"
                show-password
                @keyup.enter="onRegister"
              />
            </el-form-item>
            <el-button
              type="primary"
              :loading="loading"
              style="width: 100%"
              @click="onRegister"
            >注 册</el-button>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
.login-card {
  width: 420px;
  border-radius: 12px;
}
.brand {
  text-align: center;
  margin-bottom: 16px;
}
.brand h1 {
  margin: 0;
  font-size: 28px;
  color: #303133;
  letter-spacing: 1px;
}
.brand p {
  margin: 6px 0 0;
  color: #909399;
  font-size: 13px;
}
</style>

<script setup>
/**
 * AppLayout.vue — 主布局
 * 顶部导航 + 用户区 + <router-view>
 */
import { useRouter } from 'vue-router';
import { ElMessageBox } from 'element-plus';
import { useUserStore } from '@/stores/user';

const router = useRouter();
const userStore = useUserStore();

async function onLogout() {
  try {
    await ElMessageBox.confirm('确定退出登录？', '提示', { type: 'warning' });
    userStore.logout();
    router.replace('/login');
  } catch (_) {}
}
</script>

<template>
  <el-container class="layout">
    <el-header class="header">
      <div class="header-left">
        <div class="brand">TaskFlow</div>
        <el-menu
          :default-active="$route.path"
          mode="horizontal"
          class="nav-menu"
          background-color="transparent"
          text-color="#cfd8dc"
          active-text-color="#fff"
          :ellipsis="false"
          router
        >
          <el-menu-item index="/dashboard">仪表盘</el-menu-item>
          <el-menu-item index="/daily">今日计划</el-menu-item>
          <el-menu-item index="/tasks">任务</el-menu-item>
        </el-menu>
      </div>

      <div class="user-area" v-if="userStore.profile">
        <el-avatar :size="32" :src="userStore.profile.avatar || ''">
          {{ userStore.profile.nickname?.[0] || 'U' }}
        </el-avatar>
        <span class="nickname">{{ userStore.profile.nickname }}</span>
        <el-button size="small" @click="onLogout">退出</el-button>
      </div>
    </el-header>

    <el-main>
      <router-view />
    </el-main>
  </el-container>
</template>

<style scoped>
.layout {
  height: 100vh;
}
.header {
  background: #001529;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 36px;
}
.brand {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 1px;
}
.nav-menu {
  border-bottom: none !important;
}
.nav-menu :deep(.el-menu-item) {
  border-bottom: none !important;
}
.nav-menu :deep(.el-menu-item.is-active) {
  border-bottom: 2px solid #409eff !important;
}
.user-area {
  display: flex;
  align-items: center;
  gap: 10px;
}
.nickname {
  font-size: 14px;
}
</style>

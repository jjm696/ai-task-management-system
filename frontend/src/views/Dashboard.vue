<script setup>
/**
 * Dashboard.vue — 仪表盘（Overview）
 *
 * 内容：
 *   1. 顶部统计卡片：总任务、已完成、进行中、待处理
 *   2. 任务状态分布饼图（ECharts）
 *   3. 近 7 天完成趋势折线图（ECharts）
 *   4. AI 周报生成入口（复用 WeeklyReportDialog）
 */
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import {
  Document,
  Plus,
  TrendCharts,
  PieChart,
  CircleCheck,
  Loading,
  Clock,
  Files,
} from '@element-plus/icons-vue';
import * as echarts from 'echarts';

import { getStatistics } from '@/api/task';
import WeeklyReportDialog from '@/components/WeeklyReportDialog.vue';

const router = useRouter();

// ---------- 数据 ----------
const loading = ref(false);
const stats = ref({
  statusCounts: { PENDING: 0, IN_PROGRESS: 0, DONE: 0, total: 0 },
  daily: [],
});

// 周报弹窗
const reportVisible = ref(false);

// ---------- ECharts 实例 ----------
const pieRef = ref(null);
const lineRef = ref(null);
let pieChart = null;
let lineChart = null;

function renderPie() {
  if (!pieChart) return;
  const c = stats.value.statusCounts;
  pieChart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, icon: 'circle' },
    color: ['#909399', '#409eff', '#67c23a'],
    series: [
      {
        name: '状态分布',
        type: 'pie',
        radius: ['45%', '70%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 6,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: { show: true, formatter: '{b}\n{c}' },
        data: [
          { name: '待处理', value: c.PENDING },
          { name: '进行中', value: c.IN_PROGRESS },
          { name: '已完成', value: c.DONE },
        ],
      },
    ],
  });
}

function renderLine() {
  if (!lineChart) return;
  const daily = stats.value.daily || [];
  // x 轴只显示 MM-DD
  const xLabels = daily.map((d) => d.date.slice(5));
  const values = daily.map((d) => d.count);

  lineChart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 30, bottom: 40 },
    xAxis: {
      type: 'category',
      data: xLabels,
      axisTick: { alignWithLabel: true },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
    },
    series: [
      {
        name: '完成数',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        data: values,
        lineStyle: { width: 3, color: '#409eff' },
        itemStyle: { color: '#409eff' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(64,158,255,0.45)' },
            { offset: 1, color: 'rgba(64,158,255,0.02)' },
          ]),
        },
        label: { show: true, position: 'top', formatter: ({ value }) => (value > 0 ? value : '') },
      },
    ],
  });
}

// ---------- 拉数据 ----------
async function fetchStats() {
  loading.value = true;
  try {
    const res = await getStatistics();
    stats.value = res.data;
    await nextTick();
    renderPie();
    renderLine();
  } finally {
    loading.value = false;
  }
}

// ---------- 生命周期 ----------
function handleResize() {
  pieChart?.resize();
  lineChart?.resize();
}

onMounted(async () => {
  await nextTick();
  if (pieRef.value) pieChart = echarts.init(pieRef.value);
  if (lineRef.value) lineChart = echarts.init(lineRef.value);
  window.addEventListener('resize', handleResize);
  fetchStats();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  pieChart?.dispose();
  lineChart?.dispose();
  pieChart = null;
  lineChart = null;
});

// 周报关闭时刷新（已完成数可能变了）
watch(reportVisible, (v) => {
  if (!v) fetchStats();
});
</script>

<template>
  <div v-loading="loading" class="dashboard">
    <!-- 顶部操作栏 -->
    <div class="action-bar">
      <h2 class="page-title">仪表盘</h2>
      <div>
        <el-button :icon="Document" @click="reportVisible = true">✨ 生成周报</el-button>
        <el-button type="primary" :icon="Plus" @click="router.push('/tasks')">前往任务</el-button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <el-row :gutter="16" class="stat-row">
      <el-col :xs="12" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-inner">
            <el-icon class="stat-icon" :size="32" color="#909399"><Files /></el-icon>
            <div>
              <div class="stat-num">{{ stats.statusCounts.total }}</div>
              <div class="stat-label">总任务</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-inner">
            <el-icon class="stat-icon" :size="32" color="#67c23a"><CircleCheck /></el-icon>
            <div>
              <div class="stat-num" style="color: #67c23a">{{ stats.statusCounts.DONE }}</div>
              <div class="stat-label">已完成</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-inner">
            <el-icon class="stat-icon" :size="32" color="#409eff"><Loading /></el-icon>
            <div>
              <div class="stat-num" style="color: #409eff">{{ stats.statusCounts.IN_PROGRESS }}</div>
              <div class="stat-label">进行中</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-inner">
            <el-icon class="stat-icon" :size="32" color="#909399"><Clock /></el-icon>
            <div>
              <div class="stat-num">{{ stats.statusCounts.PENDING }}</div>
              <div class="stat-label">待处理</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 图表 -->
    <el-row :gutter="16" class="chart-row">
      <el-col :xs="24" :md="10">
        <el-card shadow="never">
          <template #header>
            <div class="chart-header">
              <el-icon><PieChart /></el-icon>
              <span>任务状态分布</span>
            </div>
          </template>
          <div ref="pieRef" class="chart-box" />
        </el-card>
      </el-col>
      <el-col :xs="24" :md="14">
        <el-card shadow="never">
          <template #header>
            <div class="chart-header">
              <el-icon><TrendCharts /></el-icon>
              <span>近 7 天完成趋势</span>
            </div>
          </template>
          <div ref="lineRef" class="chart-box" />
        </el-card>
      </el-col>
    </el-row>

    <!-- 周报弹窗 -->
    <WeeklyReportDialog v-model="reportVisible" />
  </div>
</template>

<style scoped>
.dashboard {
  min-height: 100%;
}
.action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.page-title {
  margin: 0;
  font-size: 20px;
  color: #303133;
}
.stat-row {
  margin-bottom: 16px;
}
.stat-card {
  border-radius: 8px;
}
.stat-inner {
  display: flex;
  align-items: center;
  gap: 16px;
}
.stat-icon {
  flex-shrink: 0;
}
.stat-num {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.1;
  color: #303133;
}
.stat-label {
  font-size: 13px;
  color: #909399;
  margin-top: 4px;
}
.chart-row {
  margin-bottom: 16px;
}
.chart-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  color: #303133;
}
.chart-box {
  width: 100%;
  height: 320px;
}
</style>

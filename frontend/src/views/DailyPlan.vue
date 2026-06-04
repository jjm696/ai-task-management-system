<script setup>
/**
 * DailyPlan.vue — 今日计划
 *
 * 用 DailyPlan / DailyPlanItem 将“任务池”转成当天执行清单。
 */
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Calendar, MagicStick, Plus, Delete, CircleCheck, Refresh } from '@element-plus/icons-vue';

import * as dailyApi from '@/api/dailyPlan';
import * as taskApi from '@/api/task';

const loading = ref(false);
const aiLoading = ref(false);
const plan = ref({ items: [] });
const taskOptions = ref([]);
const selectedTaskId = ref(null);

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const planDate = ref(todayKey());

const STATUS_LABEL = {
  PENDING: '待处理',
  IN_PROGRESS: '进行中',
  DONE: '已完成',
};

const STATUS_TAG = {
  PENDING: 'info',
  IN_PROGRESS: 'primary',
  DONE: 'success',
};

const PRIORITY_LABEL = {
  HIGH: '高',
  MEDIUM: '中',
  LOW: '低',
};

const PRIORITY_TAG = {
  HIGH: 'danger',
  MEDIUM: 'warning',
  LOW: 'info',
};

const items = computed(() => plan.value?.items || []);
const doneCount = computed(() => items.value.filter((item) => item.task?.status === 'DONE').length);
const totalHours = computed(() =>
  items.value.reduce((sum, item) => sum + Number(item.task?.estimatedHours || 0), 0)
);

function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function fetchPlan() {
  loading.value = true;
  try {
    const res = await dailyApi.getDailyPlan(planDate.value);
    plan.value = res.data;
  } finally {
    loading.value = false;
  }
}

async function fetchTaskOptions() {
  const res = await taskApi.listTasks({ page: 1, pageSize: 100, status: 'PENDING' });
  const pending = res.data.items || [];
  const res2 = await taskApi.listTasks({ page: 1, pageSize: 100, status: 'IN_PROGRESS' });
  taskOptions.value = [...pending, ...(res2.data.items || [])];
}

async function onDateChange() {
  await fetchPlan();
}

async function onAddTask() {
  if (!selectedTaskId.value) {
    ElMessage.warning('请选择要加入今日计划的任务');
    return;
  }
  await dailyApi.addDailyPlanItem({
    date: planDate.value,
    taskId: selectedTaskId.value,
  });
  selectedTaskId.value = null;
  ElMessage.success('已加入今日计划');
  await fetchPlan();
}

async function onGenerate() {
  aiLoading.value = true;
  try {
    const res = await dailyApi.generateDailyPlan({ date: planDate.value, limit: 6 });
    plan.value = res.data;
    ElMessage.success('AI 今日计划已生成');
  } finally {
    aiLoading.value = false;
  }
}

async function onStart(item) {
  await taskApi.updateTask(item.task.id, { status: 'IN_PROGRESS' });
  ElMessage.success('已标记为进行中');
  await fetchPlan();
}

async function onDone(item) {
  await taskApi.updateTask(item.task.id, { status: 'DONE' });
  ElMessage.success('已完成任务');
  await fetchPlan();
}

async function onRemove(item) {
  await dailyApi.removeDailyPlanItem(item.id);
  ElMessage.success('已移出今日计划');
  await fetchPlan();
}

onMounted(async () => {
  await Promise.all([fetchPlan(), fetchTaskOptions()]);
});
</script>

<template>
  <div class="daily-page">
    <div class="action-bar">
      <div>
        <h2 class="page-title">今日计划</h2>
        <p class="page-subtitle">从任务池中挑选今天真正要推进的事项。</p>
      </div>
      <div class="actions">
        <el-date-picker
          v-model="planDate"
          type="date"
          value-format="YYYY-MM-DD"
          format="YYYY-MM-DD"
          :clearable="false"
          @change="onDateChange"
        />
        <el-button :icon="Refresh" @click="fetchPlan">刷新</el-button>
        <el-button type="primary" :icon="MagicStick" :loading="aiLoading" @click="onGenerate">
          AI 生成今日计划
        </el-button>
      </div>
    </div>

    <el-row :gutter="16" class="summary-row">
      <el-col :xs="24" :sm="8">
        <el-card shadow="never">
          <div class="summary-card">
            <el-icon :size="30" color="#409eff"><Calendar /></el-icon>
            <div>
              <div class="summary-num">{{ items.length }}</div>
              <div class="summary-label">今日任务</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="8">
        <el-card shadow="never">
          <div class="summary-card">
            <el-icon :size="30" color="#67c23a"><CircleCheck /></el-icon>
            <div>
              <div class="summary-num">{{ doneCount }} / {{ items.length }}</div>
              <div class="summary-label">完成进度</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="8">
        <el-card shadow="never">
          <div class="summary-card">
            <div class="hours-icon">h</div>
            <div>
              <div class="summary-num">{{ totalHours || '—' }}</div>
              <div class="summary-label">预估总工时</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" class="add-card">
      <div class="add-row">
        <el-select
          v-model="selectedTaskId"
          filterable
          clearable
          placeholder="从未完成任务中选择加入今日计划"
          class="task-select"
        >
          <el-option
            v-for="task in taskOptions"
            :key="task.id"
            :label="`#${task.id} ${task.title}`"
            :value="task.id"
          />
        </el-select>
        <el-button type="success" :icon="Plus" @click="onAddTask">加入计划</el-button>
      </div>
    </el-card>

    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="plan-header">
          <span>{{ fmtDate(plan.date || planDate) }} 执行清单</span>
          <span v-if="plan.summary" class="summary-text">{{ plan.summary }}</span>
        </div>
      </template>

      <el-table :data="items" row-key="id" stripe>
        <el-table-column type="index" label="#" width="56" />
        <el-table-column label="任务" min-width="260" show-overflow-tooltip>
          <template #default="{ row }">
            <span>{{ row.task?.title }}</span>
            <el-tag v-if="row.task?.aiGenerated" size="small" type="success" style="margin-left: 8px">AI</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="优先级" width="90">
          <template #default="{ row }">
            <el-tag :type="PRIORITY_TAG[row.task?.priority]" size="small">
              {{ PRIORITY_LABEL[row.task?.priority] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="STATUS_TAG[row.task?.status]" size="small">
              {{ STATUS_LABEL[row.task?.status] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="预估(h)" width="90">
          <template #default="{ row }">{{ row.task?.estimatedHours ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="AI/备注" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">{{ row.note || '—' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button
              size="small"
              type="primary"
              :disabled="row.task?.status !== 'PENDING'"
              @click="onStart(row)"
            >开始</el-button>
            <el-button
              size="small"
              type="success"
              :disabled="row.task?.status === 'DONE'"
              @click="onDone(row)"
            >完成</el-button>
            <el-button size="small" type="danger" :icon="Delete" @click="onRemove(row)">移出</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="今天还没有计划。可以手动加入任务，或让 AI 生成今日计划。" />
        </template>
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.daily-page {
  min-height: 100%;
}
.action-bar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}
.page-title {
  margin: 0;
  font-size: 20px;
  color: #303133;
}
.page-subtitle {
  margin: 6px 0 0;
  color: #909399;
  font-size: 13px;
}
.actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.summary-row {
  margin-bottom: 16px;
}
.summary-card {
  display: flex;
  align-items: center;
  gap: 14px;
}
.summary-num {
  font-size: 26px;
  font-weight: 700;
  color: #303133;
}
.summary-label {
  margin-top: 4px;
  font-size: 13px;
  color: #909399;
}
.hours-icon {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: #fdf6ec;
  color: #e6a23c;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 18px;
}
.add-card {
  margin-bottom: 16px;
}
.add-row {
  display: flex;
  gap: 10px;
}
.task-select {
  flex: 1;
}
.plan-header {
  display: flex;
  align-items: center;
  gap: 16px;
}
.summary-text {
  color: #606266;
  font-size: 13px;
}
@media (max-width: 768px) {
  .action-bar,
  .add-row,
  .plan-header {
    flex-direction: column;
    align-items: stretch;
  }
  .actions {
    justify-content: flex-start;
  }
}
</style>

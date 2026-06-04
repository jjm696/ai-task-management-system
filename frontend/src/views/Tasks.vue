<script setup>
/**
 * Tasks.vue — 任务列表页
 * 提取自原 Dashboard.vue。Header 由 AppLayout 提供，本组件只渲染主体内容。
 */
import { ref, reactive, onMounted, computed } from 'vue';
import { ElMessageBox, ElMessage } from 'element-plus';
import { Plus, Edit, Delete, ArrowRight, Refresh, Calendar } from '@element-plus/icons-vue';

import * as taskApi from '@/api/task';
import * as dailyApi from '@/api/dailyPlan';
import TaskFormDialog from '@/components/TaskFormDialog.vue';

// ---------- 列表状态 ----------
const loading = ref(false);
const tableData = ref([]);
const total = ref(0);

const query = reactive({
  page: 1,
  pageSize: 10,
  status: '',
  priority: '',
  keyword: '',
});

// ---------- 字典 ----------
const PRIORITY_OPTIONS = [
  { label: '高', value: 'HIGH', tag: 'danger' },
  { label: '中', value: 'MEDIUM', tag: 'warning' },
  { label: '低', value: 'LOW', tag: 'info' },
];
const STATUS_OPTIONS = [
  { label: '待处理', value: 'PENDING', tag: 'info' },
  { label: '进行中', value: 'IN_PROGRESS', tag: 'primary' },
  { label: '已完成', value: 'DONE', tag: 'success' },
];

const priorityMap = computed(() =>
  Object.fromEntries(PRIORITY_OPTIONS.map((o) => [o.value, o]))
);
const statusMap = computed(() =>
  Object.fromEntries(STATUS_OPTIONS.map((o) => [o.value, o]))
);

const treeData = computed(() => {
  const map = new Map();
  const roots = [];
  for (const item of tableData.value) {
    map.set(item.id, { ...item, children: [] });
  }
  for (const item of map.values()) {
    if (item.parentId && map.has(item.parentId)) {
      map.get(item.parentId).children.push(item);
    } else {
      roots.push(item);
    }
  }
  return roots.map((item) => (item.children.length ? item : { ...item, children: undefined }));
});

// ---------- 拉数据 ----------
async function fetchList() {
  loading.value = true;
  try {
    const params = {
      page: query.page,
      pageSize: query.pageSize,
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.keyword ? { keyword: query.keyword } : {}),
    };
    const res = await taskApi.listTasks(params);
    tableData.value = res.data.items;
    total.value = res.data.total;
  } finally {
    loading.value = false;
  }
}

function onSearch() {
  query.page = 1;
  fetchList();
}
function onReset() {
  query.status = '';
  query.priority = '';
  query.keyword = '';
  query.page = 1;
  fetchList();
}

// ---------- 弹窗 ----------
const dialogVisible = ref(false);
const dialogLoading = ref(false);
const editing = ref(null);

function openCreate() {
  editing.value = null;
  dialogVisible.value = true;
}
function openEdit(row) {
  editing.value = { ...row };
  dialogVisible.value = true;
}

async function onSubmit(payload) {
  dialogLoading.value = true;
  try {
    if (editing.value?.id) {
      await taskApi.updateTask(editing.value.id, payload);
      ElMessage.success('已更新');
    } else {
      await taskApi.createTask(payload);
      ElMessage.success('已创建');
    }
    dialogVisible.value = false;
    fetchList();
  } finally {
    dialogLoading.value = false;
  }
}

async function onAiSubtasks(payload) {
  const subtasks = payload?.subtasks || [];
  if (!Array.isArray(subtasks) || subtasks.length === 0) return;
  const loadingMsg = ElMessage({
    type: 'info',
    message: `正在创建 1 个主任务和 ${subtasks.length} 个子任务…`,
    duration: 0,
  });
  try {
    const totalHours = subtasks.reduce((sum, s) => sum + Number(s.estimatedHours || 0), 0);
    const parentRes = await taskApi.createTask({
      ...payload.parent,
      estimatedHours: totalHours || null,
      aiGenerated: true,
      sourcePrompt: payload.sourcePrompt,
    });
    const parentId = parentRes.data.id;
    let ok = 0;
    for (const s of subtasks) {
      await taskApi.createTask({
        title: s.title,
        description: `AI 子任务，来源：${payload.sourcePrompt}`,
        priority: s.priorityEnum || 'MEDIUM',
        status: 'PENDING',
        dueDate: null,
        estimatedHours: s.estimatedHours,
        aiGenerated: true,
        sourcePrompt: payload.sourcePrompt,
        parentId,
      });
      ok += 1;
    }
    loadingMsg.close();
    ElMessage.success(`已创建主任务和 ${ok} 个子任务`);
    fetchList();
  } catch (err) {
    loadingMsg.close();
  }
}

// ---------- 行操作 ----------
const NEXT_STATUS = { PENDING: 'IN_PROGRESS', IN_PROGRESS: 'DONE', DONE: 'PENDING' };
const NEXT_LABEL = { PENDING: '开始', IN_PROGRESS: '完成', DONE: '重开' };

async function advanceStatus(row) {
  const next = NEXT_STATUS[row.status];
  await taskApi.updateTask(row.id, { status: next });
  ElMessage.success(`已变更：${statusMap.value[row.status].label} → ${statusMap.value[next].label}`);
  fetchList();
}

async function onDelete(row) {
  try {
    const suffix = row.children?.length ? '，其子任务也会一并删除' : '';
    await ElMessageBox.confirm(`确认删除任务「${row.title}」${suffix}？`, '提示', { type: 'warning' });
    await taskApi.deleteTask(row.id);
    ElMessage.success('已删除');
    if (tableData.value.length === 1 && query.page > 1) query.page -= 1;
    fetchList();
  } catch (_) {}
}

function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function todayKey() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function addToToday(row) {
  await dailyApi.addDailyPlanItem({
    date: todayKey(),
    taskId: row.id,
  });
  ElMessage.success('已加入今日计划');
}

onMounted(fetchList);
</script>

<template>
  <div>
    <!-- 筛选区 -->
    <el-card shadow="never" class="filter-card">
      <el-form inline @submit.prevent="onSearch">
        <el-form-item label="状态">
          <el-select v-model="query.status" placeholder="全部" clearable style="width: 140px">
            <el-option v-for="o in STATUS_OPTIONS" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级">
          <el-select v-model="query.priority" placeholder="全部" clearable style="width: 140px">
            <el-option v-for="o in PRIORITY_OPTIONS" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input
            v-model="query.keyword"
            placeholder="标题或描述"
            clearable
            style="width: 220px"
            @keyup.enter="onSearch"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="onSearch">搜索</el-button>
          <el-button :icon="Refresh" @click="onReset">重置</el-button>
        </el-form-item>
        <el-form-item style="margin-left: auto">
          <el-button type="success" :icon="Plus" @click="openCreate">新建任务</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 表格 -->
    <el-card shadow="never" class="table-card">
      <el-table
        v-loading="loading"
        :data="treeData"
        row-key="id"
        stripe
        default-expand-all
        :tree-props="{ children: 'children' }"
      >
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="title" label="标题" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <span>{{ row.title }}</span>
            <el-tag v-if="row.aiGenerated" size="small" type="success" style="margin-left: 8px">AI</el-tag>
            <el-tag v-if="row.parentId" size="small" type="info" style="margin-left: 6px">子任务</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="优先级" width="100">
          <template #default="{ row }">
            <el-tag :type="priorityMap[row.priority]?.tag" size="small">
              {{ priorityMap[row.priority]?.label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="statusMap[row.status]?.tag" size="small">
              {{ statusMap[row.status]?.label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="预估(h)" width="100">
          <template #default="{ row }">{{ row.estimatedHours ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="截止" width="170">
          <template #default="{ row }">{{ fmtDate(row.dueDate) }}</template>
        </el-table-column>
        <el-table-column label="完成于" width="170">
          <template #default="{ row }">{{ fmtDate(row.completedAt) }}</template>
        </el-table-column>
        <el-table-column label="创建于" width="170">
          <template #default="{ row }">{{ fmtDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="330" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" :icon="ArrowRight" @click="advanceStatus(row)">
              {{ NEXT_LABEL[row.status] }}
            </el-button>
            <el-button
              size="small"
              type="success"
              :icon="Calendar"
              :disabled="row.status === 'DONE'"
              @click="addToToday(row)"
            >今日</el-button>
            <el-button size="small" :icon="Edit" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" :icon="Delete" @click="onDelete(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无任务，点击右上角新建一个吧" />
        </template>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          background
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="fetchList"
          @size-change="fetchList"
        />
      </div>
    </el-card>

    <TaskFormDialog
      v-model="dialogVisible"
      :task="editing"
      :loading="dialogLoading"
      @submit="onSubmit"
      @ai-subtasks="onAiSubtasks"
    />
  </div>
</template>

<style scoped>
.filter-card {
  margin-bottom: 16px;
}
.filter-card :deep(.el-form) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}
.table-card {
  min-height: 400px;
}
.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>

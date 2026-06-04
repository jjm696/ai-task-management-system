<script setup>
/**
 * AiBreakdownDialog.vue — AI 智能任务拆解对话框
 *
 * 流程：
 *   1. 用户在 textarea 中输入一句话任务描述
 *   2. 点击「✨ AI 拆解」调用 /api/ai/task-breakdown
 *   3. 拉取后展示子任务列表（标题 / 优先级 / 预估工时），用户可勾选要采纳的项
 *   4. 点击「应用」→ emit('apply', selectedSubtasks)，由父组件落库
 *
 * Props:
 *   - modelValue: v-model 控制显示
 *   - defaultInput: 默认填充的输入（来自 TaskFormDialog 的当前 title）
 * Emits:
 *   - update:modelValue
 *   - apply: ({ sourcePrompt, subtasks })
 */
import { ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { MagicStick, Refresh } from '@element-plus/icons-vue';
import { taskBreakdown } from '@/api/ai';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  defaultInput: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue', 'apply']);

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const userInput = ref('');
const loading = ref(false);
const subtasks = ref([]); // [{ title, priority, priorityEnum, estimatedHours, _checked }]
const errorMsg = ref('');

const PRIORITY_TAG = { 高: 'danger', 中: 'warning', 低: 'info' };

const checkedCount = computed(() => subtasks.value.filter((s) => s._checked).length);
const allChecked = computed(
  () => subtasks.value.length > 0 && subtasks.value.every((s) => s._checked)
);
const totalHours = computed(() =>
  subtasks.value.filter((s) => s._checked).reduce((sum, s) => sum + (s.estimatedHours || 0), 0)
);

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      userInput.value = props.defaultInput || '';
      subtasks.value = [];
      errorMsg.value = '';
      loading.value = false;
    }
  }
);

async function onGenerate() {
  if (!userInput.value.trim()) {
    ElMessage.warning('请先输入任务描述');
    return;
  }
  loading.value = true;
  errorMsg.value = '';
  try {
    const res = await taskBreakdown(userInput.value.trim());
    subtasks.value = (res.data?.subtasks || []).map((s) => ({ ...s, _checked: true }));
    if (subtasks.value.length === 0) {
      errorMsg.value = 'AI 未返回有效子任务，请重试或换种描述。';
    }
  } catch (err) {
    // request.js 已经弹过 ElMessage.error，这里再额外在面板内展示一份便于复读
    errorMsg.value = err.response?.data?.message || err.message || 'AI 调用失败';
  } finally {
    loading.value = false;
  }
}

function toggleAll(val) {
  subtasks.value.forEach((s) => (s._checked = val));
}

function onApply() {
  const selected = subtasks.value.filter((s) => s._checked);
  if (selected.length === 0) {
    ElMessage.warning('请至少选择一项子任务');
    return;
  }
  emit(
    'apply',
    {
      sourcePrompt: userInput.value.trim(),
      subtasks: selected.map((s) => ({
        title: s.title,
        priorityEnum: s.priorityEnum, // 'HIGH' | 'MEDIUM' | 'LOW'
        estimatedHours: s.estimatedHours,
      })),
    }
  );
  visible.value = false;
}
</script>

<template>
  <el-dialog
    v-model="visible"
    title="✨ AI 智能任务拆解"
    width="640px"
    :close-on-click-modal="false"
  >
    <el-form @submit.prevent="onGenerate">
      <el-form-item label="任务描述" label-position="top">
        <el-input
          v-model="userInput"
          type="textarea"
          :rows="3"
          placeholder="例：准备明天下午3点的客户演示会议"
          maxlength="500"
          show-word-limit
          :disabled="loading"
        />
      </el-form-item>
      <el-form-item>
        <el-button
          type="primary"
          :icon="MagicStick"
          :loading="loading"
          @click="onGenerate"
        >{{ subtasks.length ? '重新生成' : 'AI 拆解' }}</el-button>
        <el-button
          v-if="subtasks.length"
          :icon="Refresh"
          @click="subtasks = []"
        >清空结果</el-button>
      </el-form-item>
    </el-form>

    <!-- 错误提示 -->
    <el-alert
      v-if="errorMsg"
      :title="errorMsg"
      type="error"
      show-icon
      :closable="false"
      style="margin-bottom: 12px"
    />

    <!-- Loading 占位 -->
    <div v-if="loading && subtasks.length === 0" v-loading="true" class="loading-area">
      <p style="text-align: center; color: #909399">AI 正在思考，请稍候…</p>
    </div>

    <!-- 结果列表 -->
    <div v-if="subtasks.length > 0" class="result-area">
      <div class="result-header">
        <el-checkbox
          :model-value="allChecked"
          :indeterminate="checkedCount > 0 && !allChecked"
          @change="toggleAll"
        >全选</el-checkbox>
        <span class="summary">
          已选 <b>{{ checkedCount }}</b> / {{ subtasks.length }}，
          预计共 <b>{{ totalHours }}</b> 小时
        </span>
      </div>

      <el-table :data="subtasks" border size="small">
        <el-table-column width="50" align="center">
          <template #default="{ row }">
            <el-checkbox v-model="row._checked" />
          </template>
        </el-table-column>
        <el-table-column prop="title" label="子任务" min-width="240" />
        <el-table-column label="优先级" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="PRIORITY_TAG[row.priority]" size="small">{{ row.priority }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="预估(h)" width="90" align="center">
          <template #default="{ row }">{{ row.estimatedHours }}</template>
        </el-table-column>
      </el-table>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button
        type="primary"
        :disabled="checkedCount === 0"
        @click="onApply"
      >应用所选 ({{ checkedCount }})</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.loading-area {
  min-height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.result-area {
  margin-top: 8px;
}
.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.summary {
  color: #606266;
  font-size: 13px;
}
</style>

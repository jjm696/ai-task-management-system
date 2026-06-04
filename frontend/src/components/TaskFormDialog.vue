<script setup>
/**
 * TaskFormDialog.vue — 新建 / 编辑任务对话框
 *
 * Props:
 *   - modelValue: 控制显示（v-model）
 *   - task: 编辑模式时传入；为 null/undefined 即为新建
 * Emits:
 *   - update:modelValue
 *   - submit (payload)  父组件负责调 API
 */
import { ref, reactive, watch, computed } from 'vue';
import { MagicStick } from '@element-plus/icons-vue';
import AiBreakdownDialog from './AiBreakdownDialog.vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  task: { type: Object, default: null },
  loading: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue', 'submit', 'aiSubtasks']);

// ✨ AI 拆解弹窗
const aiDialogVisible = ref(false);
function openAiDialog() {
  aiDialogVisible.value = true;
}
function onAiApply(payload) {
  // 把 AI 返回的规划结果向上抛给任务页，由其创建主任务 + 子任务
  emit('aiSubtasks', {
    parent: {
      title: form.title.trim() || payload.sourcePrompt,
      description: form.description?.trim() || payload.sourcePrompt,
      priority: form.priority,
      status: 'PENDING',
      dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
    },
    sourcePrompt: payload.sourcePrompt,
    subtasks: payload.subtasks,
  });
  // 同时关闭本任务弹窗（因为 Dashboard 会刷新列表，没必要再让用户手动提交）
  visible.value = false;
}

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const isEdit = computed(() => !!props.task?.id);

const formRef = ref();
const form = reactive({
  title: '',
  description: '',
  priority: 'MEDIUM',
  status: 'PENDING',
  estimatedHours: null,
  dueDate: null, // Date 对象，提交时转 ISO
});

const rules = {
  title: [
    { required: true, message: '请输入任务标题', trigger: 'blur' },
    { max: 200, message: '标题长度不超过 200', trigger: 'blur' },
  ],
};

// 打开时根据 task 填充
watch(
  () => props.modelValue,
  (val) => {
    if (!val) return;
    if (props.task) {
      form.title = props.task.title || '';
      form.description = props.task.description || '';
      form.priority = props.task.priority || 'MEDIUM';
      form.status = props.task.status || 'PENDING';
      form.estimatedHours = props.task.estimatedHours ?? null;
      form.dueDate = props.task.dueDate ? new Date(props.task.dueDate) : null;
    } else {
      form.title = '';
      form.description = '';
      form.priority = 'MEDIUM';
      form.status = 'PENDING';
      form.estimatedHours = null;
      form.dueDate = null;
    }
    // 清除上次校验提示
    formRef.value?.clearValidate?.();
  }
);

async function onConfirm() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  emit('submit', {
    title: form.title.trim(),
    description: form.description?.trim() || null,
    priority: form.priority,
    status: form.status,
    estimatedHours: form.estimatedHours || null,
    dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
  });
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? '编辑任务' : '新建任务'"
    width="560px"
    :close-on-click-modal="false"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
      <el-form-item label="标题" prop="title">
        <div class="title-row">
          <el-input
            v-model="form.title"
            placeholder="任务标题"
            maxlength="200"
            show-word-limit
            class="title-input"
          />
          <el-tooltip content="AI 智能拆解为多个子任务" placement="top">
            <el-button
              type="primary"
              :icon="MagicStick"
              circle
              @click="openAiDialog"
            />
          </el-tooltip>
        </div>
      </el-form-item>

      <el-form-item label="描述">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          placeholder="任务描述（可选）"
          maxlength="5000"
        />
      </el-form-item>

      <el-form-item label="优先级">
        <el-radio-group v-model="form.priority">
          <el-radio-button label="HIGH">高</el-radio-button>
          <el-radio-button label="MEDIUM">中</el-radio-button>
          <el-radio-button label="LOW">低</el-radio-button>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="状态">
        <el-radio-group v-model="form.status">
          <el-radio-button label="PENDING">待处理</el-radio-button>
          <el-radio-button label="IN_PROGRESS">进行中</el-radio-button>
          <el-radio-button label="DONE">已完成</el-radio-button>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="预估工时">
        <el-input-number
          v-model="form.estimatedHours"
          :min="0"
          :max="10000"
          :precision="1"
          placeholder="可选"
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item label="截止日期">
        <el-date-picker
          v-model="form.dueDate"
          type="datetime"
          placeholder="选择日期时间"
          style="width: 100%"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="loading" @click="onConfirm">
        {{ isEdit ? '保存' : '创建' }}
      </el-button>
    </template>

    <!-- AI 拆解嵌套弹窗 -->
    <AiBreakdownDialog
      v-model="aiDialogVisible"
      :default-input="form.title"
      @apply="onAiApply"
    />
  </el-dialog>
</template>

<style scoped>
.title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}
.title-input {
  flex: 1;
}
</style>

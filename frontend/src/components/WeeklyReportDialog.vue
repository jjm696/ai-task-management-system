<script setup>
/**
 * WeeklyReportDialog.vue — AI 周报生成
 *
 * 功能：
 *   - 日期范围选择（默认本周一 → 今天）
 *   - 调用 /api/ai/weekly-report 生成 Markdown
 *   - 使用 marked + DOMPurify 安全渲染预览
 *   - 复制到剪贴板 / 导出为 .md 文件
 */
import { ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Document, CopyDocument, Download } from '@element-plus/icons-vue';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

import { generateWeeklyReport } from '@/api/ai';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue']);

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

// ---------- 状态 ----------
const dateRange = ref([]); // [startDate, endDate]
const loading = ref(false);
const markdown = ref('');
const meta = ref({ taskCount: 0, startDate: '', endDate: '' });

// 初始化默认范围（本周一 → 今天）
function getDefaultRange() {
  const now = new Date();
  const day = now.getDay() === 0 ? 7 : now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day - 1));
  monday.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return [monday, end];
}

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      dateRange.value = getDefaultRange();
      markdown.value = '';
      meta.value = { taskCount: 0, startDate: '', endDate: '' };
      loading.value = false;
    }
  }
);

// ---------- 安全渲染 ----------
const renderedHtml = computed(() => {
  if (!markdown.value) return '';
  const raw = marked.parse(markdown.value, { breaks: true });
  return DOMPurify.sanitize(raw);
});

// ---------- 生成 ----------
async function onGenerate() {
  loading.value = true;
  markdown.value = '';
  try {
    const [start, end] = dateRange.value || [];
    const payload = {};
    if (start) payload.startDate = new Date(start).toISOString();
    if (end) payload.endDate = new Date(end).toISOString();

    const res = await generateWeeklyReport(payload);
    markdown.value = res.data?.markdown || '';
    meta.value = {
      taskCount: res.data?.taskCount || 0,
      startDate: res.data?.startDate || '',
      endDate: res.data?.endDate || '',
    };

    if (meta.value.taskCount === 0) {
      ElMessage.warning('该时间段内没有已完成的任务，AI 已基于空数据生成模板。');
    } else {
      ElMessage.success(`已基于 ${meta.value.taskCount} 个已完成任务生成周报`);
    }
  } finally {
    loading.value = false;
  }
}

// ---------- 复制 ----------
async function onCopy() {
  if (!markdown.value) return;
  try {
    await navigator.clipboard.writeText(markdown.value);
    ElMessage.success('已复制到剪贴板');
  } catch (_) {
    // Fallback：用 textarea 选中复制
    const ta = document.createElement('textarea');
    ta.value = markdown.value;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    ElMessage.success('已复制到剪贴板');
  }
}

// ---------- 导出 .md ----------
function onExport() {
  if (!markdown.value) return;
  const blob = new Blob([markdown.value], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `weekly-report-${stamp}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  ElMessage.success('已下载');
}

function fmtRange() {
  const s = meta.value.startDate ? new Date(meta.value.startDate).toLocaleDateString() : '';
  const e = meta.value.endDate ? new Date(meta.value.endDate).toLocaleDateString() : '';
  return s && e ? `${s} ~ ${e}` : '';
}
</script>

<template>
  <el-dialog
    v-model="visible"
    title="📝 AI 周报生成"
    width="780px"
    :close-on-click-modal="false"
    top="6vh"
  >
    <el-form inline>
      <el-form-item label="时间范围">
        <el-date-picker
          v-model="dateRange"
          type="datetimerange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          format="YYYY-MM-DD HH:mm"
          value-format="x"
          :disabled="loading"
        />
      </el-form-item>
      <el-form-item>
        <el-button
          type="primary"
          :icon="Document"
          :loading="loading"
          @click="onGenerate"
        >{{ markdown ? '重新生成' : '生成周报' }}</el-button>
      </el-form-item>
    </el-form>

    <div v-if="loading && !markdown" v-loading="true" class="loading-area">
      <p>AI 正在为您撰写周报，请稍候…</p>
    </div>

    <div v-if="markdown" class="report-area">
      <div class="meta-bar">
        <span>统计区间：<b>{{ fmtRange() }}</b></span>
        <span>已完成任务：<b>{{ meta.taskCount }}</b> 个</span>
        <div class="actions">
          <el-button size="small" :icon="CopyDocument" @click="onCopy">复制</el-button>
          <el-button size="small" type="success" :icon="Download" @click="onExport">导出 .md</el-button>
        </div>
      </div>

      <div class="markdown-body" v-html="renderedHtml" />
    </div>

    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.loading-area {
  min-height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
}
.report-area {
  margin-top: 8px;
}
.meta-bar {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 10px 14px;
  background: #f5f7fa;
  border-radius: 6px;
  font-size: 13px;
  color: #606266;
  margin-bottom: 12px;
}
.meta-bar .actions {
  margin-left: auto;
}
.markdown-body {
  padding: 16px 18px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  max-height: 52vh;
  overflow-y: auto;
  line-height: 1.7;
  font-size: 14px;
  color: #303133;
}
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  margin: 18px 0 10px;
  color: #1f2d3d;
}
.markdown-body :deep(h1) { font-size: 20px; }
.markdown-body :deep(h2) { font-size: 17px; }
.markdown-body :deep(h3) { font-size: 15px; }
.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 24px;
}
.markdown-body :deep(li) {
  margin: 4px 0;
}
.markdown-body :deep(code) {
  background: #f1f3f4;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 13px;
}
.markdown-body :deep(pre) {
  background: #f6f8fa;
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
}
.markdown-body :deep(blockquote) {
  border-left: 3px solid #409eff;
  padding: 4px 12px;
  margin: 10px 0;
  color: #606266;
  background: #ecf5ff;
}
</style>

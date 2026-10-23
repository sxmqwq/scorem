<script setup lang="ts">
import { api, apiBase, auth, toast, useTask, type Item } from "../api";
import Icon from "./Icon.vue";
const props = defineProps<{
    kind: string;
    id: string;
    files: Item[];
    editable?: boolean;
  }>(),
  emit = defineEmits<{ updated: [] }>();
const { busy, error, run } = useTask();
async function upload(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0];
  if (!file) return;
  await run(async () => {
    if (file.size > 1048576)
      throw Error("PDF 不能超过 1 MiB，较大文件请填写外部来源链接。");
    await api(`/api/admin/${props.kind}/${props.id}/attachments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/pdf",
        "X-File-Name": encodeURIComponent(file.name),
      },
      body: file,
    });
    toast("附件已上传");
    emit("updated");
  });
  input.value = "";
}
async function remove(file: Item) {
  if (!window.confirm(`删除附件「${file.name}」？`)) return;
  await run(async () => {
    await api(`/api/admin/attachments/${file.id}`, {
      method: "DELETE",
      json: {},
    });
    toast("附件已删除");
    emit("updated");
  });
}
async function download(file: Item) {
  await run(async () => {
    const response = await fetch(`${apiBase}/api/files/${file.id}`, {
      headers: auth.token ? { Authorization: "Bearer " + auth.token } : {},
      credentials: "omit",
    });
    if (!response.ok) throw Error("附件下载失败，请刷新后重试");
    const href = URL.createObjectURL(await response.blob());
    const a = document.createElement("a");
    a.href = href;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  });
}
</script>
<template>
  <section v-if="files.length || editable" class="attachments">
    <div class="section-heading">
      <h3>题面与附件</h3>
      <label v-if="editable" class="btn small upload-label"
        ><Icon name="upload" :size="16" />{{ busy ? "正在上传…" : "上传 PDF"
        }}<input
          type="file"
          accept="application/pdf,.pdf"
          :disabled="busy"
          @change="upload"
      /></label>
    </div>
    <p class="muted small-note" v-if="editable">
      每个 PDF 最大 1 MiB，每项最多 5 个；较大文件可使用外部链接。
    </p>
    <p v-if="error" class="error-box" role="alert">{{ error }}</p>
    <div v-for="file in files" :key="file.id" class="attachment-row">
      <span class="file-badge">PDF</span
      ><button
        class="text-btn filename"
        :disabled="busy"
        @click="download(file)"
      >
        {{ file.name }}</button
      ><small>{{ Math.ceil(file.size / 1024) }} KB</small
      ><button
        v-if="editable"
        class="icon-btn"
        :disabled="busy"
        @click="remove(file)"
        :aria-label="`删除${file.name}`"
      >
        <Icon name="close" :size="16" /></button
      ><button
        v-else
        class="icon-btn"
        :disabled="busy"
        :aria-label="`下载${file.name}`"
        @click="download(file)"
      >
        <Icon name="download" :size="17" />
      </button>
    </div>
  </section>
</template>

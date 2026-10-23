<script setup lang="ts">
defineProps<{ page: number; total: number; pageSize: number }>();
defineEmits<{ change: [page: number] }>();
</script>
<template>
  <nav v-if="total > pageSize" class="pagination" aria-label="分页">
    <span
      >共 {{ total }} 项 · 第 {{ page }} /
      {{ Math.ceil(total / pageSize) }} 页</span
    >
    <div>
      <button
        class="btn small"
        :disabled="page <= 1"
        @click="$emit('change', page - 1)"
      >
        上一页</button
      ><button
        class="btn small"
        :disabled="page * pageSize >= total"
        @click="$emit('change', page + 1)"
      >
        下一页
      </button>
    </div>
  </nav>
</template>

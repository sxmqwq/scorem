<script setup lang="ts">
withDefaults(defineProps<{ name?: string; size?: number }>(), {
  name: "arrow",
  size: 20,
});
const paths: Record<string, string> = {
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  trophy:
    "M8 3h8v5a4 4 0 0 1-8 0z M8 5H4v2a4 4 0 0 0 4 4 M16 5h4v2a4 4 0 0 1-4 4 M12 12v6 M8 21h8 M9 18h6",
  book: "M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4z M13 7a3 3 0 0 1 3-3h5v15h-4a4 4 0 0 0-4 2",
  chart: "M4 3v17h17 M8 15l4-5 4 3 5-8",
  user: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-3a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v3",
  shield: "M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z M8 12l3 3 5-6",
  search: "M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0 M15 15l6 6",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  back: "M19 12H5 M11 6l-6 6 6 6",
  plus: "M12 5v14 M5 12h14",
  star: "m12 3 2.7 5.5 6 .9-4.4 4.2 1.1 6-5.4-2.8-5.4 2.8 1.1-6L3.3 9.4l6-.9z",
  upload: "M12 16V3 M7 8l5-5 5 5 M4 15v6h16v-6",
  download: "M12 3v13 M7 11l5 5 5-5 M4 16v5h16v-5",
  close: "M6 6l12 12 M6 18 18 6",
  check: "M4 12l5 5L20 6",
  link: "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2 M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2",
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 7v5l3 2",
  message: "M4 4h16v12H9l-5 4z",
  logout: "M9 4H4v16h5 M11 12h10 M17 8l4 4-4 4",
  edit: "m15 4 5 5 M4 20l1-5L16 4a3 3 0 0 1 4 4L9 19z",
};
</script>
<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.65"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="paths[name] || paths.arrow" />
  </svg>
</template>

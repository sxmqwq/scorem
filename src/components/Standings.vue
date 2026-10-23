<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  api,
  auth,
  download,
  toast,
  useTask,
  type Item,
  type Page,
} from "../api";
import { serializeCSV, parseCSV } from "../csv.mjs";
import Icon from "./Icon.vue";
import Pagination from "./Pagination.vue";
const props = defineProps<{ contest: Item }>(),
  emit = defineEmits<{ updated: [] }>();
const data = ref<Page>({ items: [], total: 0, page: 1, pageSize: 100 });
const loadError = ref(""),
  loading = ref(false),
  csv = ref(""),
  filename = ref(""),
  preview = ref<any>(null);
const { busy, error, run } = useTask();
const isAdmin = computed(
  () => auth.user?.role === "admin" && auth.user.status === "approved",
);
async function load(page = 1) {
  loading.value = true;
  loadError.value = "";
  try {
    data.value = await api(
      `/api/contests/${props.contest.id}/standings?page=${page}`,
    );
  } catch (e) {
    loadError.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}
function template() {
  const labels = props.contest.problems.map((p: Item) => p.label);
  download(
    "scorem-standings-template.csv",
    serializeCSV(
      ["external_key", "display_name", "username", ...labels],
      [
        {
          external_key: "contestant-001",
          display_name: "示例选手",
          username: "",
          ...Object.fromEntries(labels.map((l: string) => [l, 0])),
        },
      ],
    ),
    "text/csv;charset=utf-8",
  );
}
async function selectFile(event: Event) {
  preview.value = null;
  csv.value = "";
  const input = event.target as HTMLInputElement,
    file = input.files?.[0];
  if (!file) return;
  await run(async () => {
    if (file.size > 1_000_000) throw Error("CSV 不能超过 1 MB");
    const text = await file.text();
    parseCSV(text);
    csv.value = text;
    filename.value = file.name;
  });
  input.value = "";
}
async function validate() {
  await run(async () => {
    preview.value = await api(
      `/api/admin/contests/${props.contest.id}/standings`,
      {
        method: "PUT",
        json: {
          csv: csv.value,
          revision: props.contest.standings_revision,
          preview: true,
        },
      },
    );
  });
}
async function importData() {
  if (
    !window.confirm(
      `将使用 ${preview.value.count} 行成绩替换本场现有成绩，是否继续？`,
    )
  )
    return;
  await run(async () => {
    await api(`/api/admin/contests/${props.contest.id}/standings`, {
      method: "PUT",
      json: { csv: csv.value, revision: props.contest.standings_revision },
    });
    preview.value = null;
    csv.value = "";
    filename.value = "";
    emit("updated");
    await load();
    toast("成绩已导入；启用 Rating 的比赛需在管理台重算榜单");
  });
}
async function clear() {
  if (!window.confirm("清空本场全部成绩及账号关联？之后需要重新导入。")) return;
  await run(async () => {
    await api(`/api/admin/contests/${props.contest.id}/standings`, {
      method: "DELETE",
      json: { revision: props.contest.standings_revision },
    });
    emit("updated");
    await load();
    toast("成绩已清空");
  });
}
async function mapUser(row: Item) {
  const name = window.prompt(
    `为选手「${row.display_name}」（${row.external_key}）关联准确的用户名；留空解除关联。`,
    row.username || "",
  );
  if (name == null) return;
  await run(async () => {
    await api(`/api/admin/standings/${row.id}/user`, {
      method: "PATCH",
      json: { username: name, revision: props.contest.standings_revision },
    });
    emit("updated");
    await load(data.value.page);
    toast("关联已更新，请重新计算 Rating");
  });
}
onMounted(() => load());
</script>
<template>
  <section>
    <div class="section-heading">
      <h2>
        成绩榜 <span class="count-label">{{ data.total }}</span>
      </h2>
      <span class="muted small-note"
        >同分并列 · 满分
        {{
          contest.problems.reduce((s: number, p: Item) => s + p.max_score, 0)
        }}</span
      >
    </div>
    <details v-if="isAdmin" class="admin-import">
      <summary><Icon name="upload" :size="17" />管理成绩导入</summary>
      <p>
        上传任意 OJ 整理后的 CSV。选手编号需唯一；只有准确填写已审核账号的
        <code>username</code> 才会关联用户，空白选手仍可进入成绩榜。
      </p>
      <div class="button-row">
        <button class="btn small" @click="template">
          <Icon name="download" :size="16" />下载 CSV 模板</button
        ><label class="btn small upload-label"
          ><Icon name="upload" :size="16" />选择 CSV<input
            type="file"
            accept=".csv,text/csv"
            :disabled="busy"
            @change="selectFile" /></label
        ><button
          v-if="csv"
          class="btn primary small"
          :disabled="busy"
          @click="validate"
        >
          校验数据</button
        ><button
          v-if="data.total"
          class="btn small danger"
          :disabled="busy"
          @click="clear"
        >
          清空成绩
        </button>
      </div>
      <p v-if="filename" class="muted">已选择：{{ filename }}</p>
      <div v-if="preview" class="import-preview">
        <strong
          >校验通过 · {{ preview.count }} 名选手，{{
            preview.mapped
          }}
          个账号已关联</strong
        >
        <p class="muted small-note">
          以下为前 5 行预览。确认导入将替换整场成绩。
        </p>
        <ul>
          <li v-for="row in preview.preview" :key="row.external_key">
            #{{ row.rank }} {{ row.display_name }}
            <code>{{ row.external_key }}</code>
            <strong>{{ row.total }} 分</strong>
          </li>
        </ul>
        <button class="btn primary small" :disabled="busy" @click="importData">
          确认替换成绩
        </button>
      </div>
    </details>
    <p v-if="error" class="error-box" role="alert">{{ error }}</p>
    <p v-if="loadError" class="error-box" role="alert">
      {{ loadError }} <button class="text-btn" @click="load()">重试</button>
    </p>
    <div v-if="loading" class="loading-state">正在加载成绩…</div>
    <div
      v-else-if="!data.items.length && !loadError"
      class="empty-state compact"
    >
      <Icon name="chart" :size="30" />
      <h3>成绩榜还在等待上传</h3>
      <p>评分无需参赛，管理员可以稍后补充比赛成绩。</p>
    </div>
    <div v-else-if="data.items.length" class="table-wrap">
      <table class="standings-table">
        <thead>
          <tr>
            <th>名次</th>
            <th>选手</th>
            <th v-for="p in contest.problems" :key="p.id">
              {{ p.label }} <small>/ {{ p.max_score }}</small>
            </th>
            <th>总分</th>
            <th v-if="contest.rated">Rating Δ</th>
            <th v-if="isAdmin">关联账号</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in data.items" :key="row.id">
            <td>
              <span class="rank" :class="{ 'top-rank': row.rank <= 3 }">{{
                String(row.rank).padStart(2, "0")
              }}</span>
            </td>
            <td>
              <RouterLink
                v-if="row.user_id"
                :to="`/users/${row.user_id}`"
                class="strong"
                >{{ row.display_name }}</RouterLink
              ><strong v-else>{{ row.display_name }}</strong
              ><small class="block muted">{{ row.external_key }}</small>
            </td>
            <td
              v-for="p in contest.problems"
              :key="p.id"
              :class="{ perfect: row.scores[p.label] === p.max_score }"
            >
              {{ row.scores[p.label] ?? "—" }}
            </td>
            <td class="total-score">{{ row.total }}</td>
            <td v-if="contest.rated">
              <span
                v-if="row.post_rating != null"
                :class="
                  row.post_rating >= row.pre_rating ? 'positive' : 'negative'
                "
                >{{ row.post_rating - row.pre_rating >= 0 ? "+" : ""
                }}{{ row.post_rating - row.pre_rating }}</span
              ><span v-else class="muted">—</span>
            </td>
            <td v-if="isAdmin">
              <button class="text-btn" :disabled="busy" @click="mapUser(row)">
                {{ row.username || "关联用户" }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <Pagination v-bind="data" @change="load" />
    <p v-if="contest.rated" class="muted small-note">
      Rating 仅计算已关联账号且总分大于 0 的选手，管理员重算后更新。
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  api,
  auth,
  refreshUser,
  download,
  useTask,
  toast,
  type Item,
} from "../api";
import Icon from "../components/Icon.vue";
import Attachments from "../components/Attachments.vue";
const route = useRoute(),
  router = useRouter(),
  kind = String(route.params.kind),
  isProblem = kind === "problems",
  id = route.params.id ? String(route.params.id) : "";
const allowed = computed(
  () => auth.user?.role === "admin" && auth.user.status === "approved",
);
const { busy, error, run } = useTask(),
  files = ref<Item[]>([]),
  search = ref(""),
  matches = ref<Item[]>([]),
  searchError = ref("");
const localDate = (value: string) => {
  const d = new Date(value);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
const form = reactive<{ problems: Item[]; [key: string]: any }>({
  title: "",
  description: "",
  source: "",
  source_url: "",
  statement: "",
  status: "draft",
  rated: false,
  start_at: localDate(new Date().toISOString()),
  end_at: localDate(new Date(Date.now() + 4 * 3600000).toISOString()),
  revision: 1,
  problems: [
    {
      label: "A",
      title: "",
      max_score: 100,
      source: "",
      source_url: "",
      statement: "",
    },
  ],
});
async function load() {
  await run(async () => {
    if (!auth.user) await refreshUser();
    if (!allowed.value) return;
    if (id) {
      const item = await api(`/api/${kind}/${id}`);
      Object.assign(form, item);
      files.value = item.attachments;
      if (!isProblem) {
        form.start_at = localDate(item.start_at);
        form.end_at = localDate(item.end_at);
        form.rated = !!item.rated;
      }
    }
  });
}
function add(problem?: Item) {
  if (form.problems.length >= 30) {
    toast("每场比赛最多 30 道题");
    return;
  }
  const next = form.problems.length;
  form.problems.push(
    problem
      ? {
          id: problem.id,
          title: problem.title,
          label: next < 26 ? String.fromCharCode(65 + next) : "P" + (next + 1),
          max_score: 100,
        }
      : {
          label: next < 26 ? String.fromCharCode(65 + next) : "P" + (next + 1),
          title: "",
          max_score: 100,
          source: "",
          source_url: "",
          statement: "",
        },
  );
  matches.value = [];
  search.value = "";
}
async function searchProblems() {
  searchError.value = "";
  try {
    matches.value = (
      await api("/api/problems?all=1&q=" + encodeURIComponent(search.value))
    ).items;
    if (!matches.value.length)
      searchError.value = "没有找到题目，可换个关键词或手动新增。";
  } catch (e) {
    searchError.value = (e as Error).message;
  }
}
async function save() {
  await run(async () => {
    const payload = { ...form };
    if (!isProblem) {
      payload.start_at = new Date(form.start_at).toISOString();
      payload.end_at = new Date(form.end_at).toISOString();
    }
    const result = await api(`/api/admin/${kind}${id ? "/" + id : ""}`, {
      method: id ? "PUT" : "POST",
      json: payload,
    });
    toast("保存成功");
    await router.push(`/${kind}/${result.id}`);
  });
}
function sample() {
  const value = {
    title: "示例训练赛",
    description: "请替换为比赛介绍（支持 Markdown）。",
    source: "自建 OJ",
    source_url: "",
    start_at: "2026-01-01T01:00:00Z",
    end_at: "2026-01-01T05:00:00Z",
    status: "draft",
    rated: false,
    problems: [
      {
        label: "A",
        title: "示例题目",
        max_score: 100,
        source: "自建 OJ",
        source_url: "",
        statement: "# 题目描述\n\n请填写题目内容。",
      },
    ],
  };
  download(
    "scorem-contest-template.json",
    JSON.stringify(value, null, 2),
    "application/json",
  );
}
async function importJSON(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0];
  if (!file) return;
  await run(async () => {
    if (file.size > 1_000_000) throw Error("JSON 文件不能超过 1 MB");
    let value: any;
    try {
      value = JSON.parse(await file.text());
    } catch {
      throw Error("JSON 格式错误");
    }
    if (
      !value ||
      typeof value !== "object" ||
      !Array.isArray(value.problems) ||
      value.problems.length < 1 ||
      value.problems.length > 30
    )
      throw Error("比赛 JSON 需要包含 1–30 道题目的 problems 数组");
    for (const key of ["title", "description", "source", "source_url"])
      form[key] = typeof value[key] === "string" ? value[key] : "";
    form.start_at = localDate(value.start_at);
    form.end_at = localDate(value.end_at);
    form.rated = value.rated === true;
    form.status = "draft";
    form.problems = value.problems.map((p: any) => ({
      ...(typeof p.id === "string" ? { id: p.id } : {}),
      label: String(p.label || ""),
      title: String(p.title || ""),
      max_score: Number(p.max_score),
      source: String(p.source || ""),
      source_url: String(p.source_url || ""),
      statement: String(p.statement || ""),
    }));
    toast("已填入表单，请核对后保存");
  });
  input.value = "";
}
function move(index: number, direction: number) {
  const next = index + direction;
  if (next < 0 || next >= form.problems.length) return;
  [form.problems[index], form.problems[next]] = [
    form.problems[next],
    form.problems[index],
  ];
}
onMounted(load);
</script>
<template>
  <RouterLink to="/admin" class="back-link"
    ><Icon name="back" :size="17" />返回管理工作台</RouterLink
  >
  <section class="page-intro editor-intro">
    <div class="eyebrow">
      <span></span>{{ isProblem ? "PROBLEM EDITOR" : "CONTEST EDITOR" }}
    </div>
    <h1>{{ id ? "编辑" : "添加" }}{{ isProblem ? "题目" : "比赛" }}</h1>
    <p class="lead">
      {{
        isProblem
          ? "独立收录题面与来源，可在多场比赛中复用。"
          : "手动录入或导入 JSON，来自任何 OJ 的比赛都可以收录。"
      }}
    </p>
  </section>
  <p v-if="error" class="error-box" role="alert">{{ error }}</p>
  <section
    v-if="auth.token && !auth.user"
    class="panel empty-state"
    role="status"
  >
    <h2>{{ busy ? "正在恢复登录…" : "暂时无法连接账号服务" }}</h2>
    <p>登录信息已保留，请稍后重试。</p>
    <button class="btn primary" :disabled="busy" @click="load()">
      重试连接
    </button>
  </section>
  <section v-else-if="!allowed && !busy" class="panel empty-state">
    <h2>需要管理员权限</h2>
    <RouterLink class="btn" to="/login">登录</RouterLink>
  </section>
  <form v-if="allowed" class="editor-form" @submit.prevent="save">
    <section class="panel content-panel">
      <div class="section-heading">
        <h2>基本信息</h2>
        <div v-if="!isProblem && !id" class="button-row">
          <button type="button" class="btn small" @click="sample">
            下载 JSON 模板</button
          ><label class="btn small upload-label"
            ><Icon name="upload" :size="16" />导入 JSON<input
              type="file"
              accept="application/json,.json"
              @change="importJSON"
          /></label>
        </div>
      </div>
      <label
        >{{ isProblem ? "题目名称" : "比赛名称"
        }}<input
          v-model="form.title"
          required
          maxlength="160"
          :placeholder="isProblem ? '输入题目名称' : '输入一个清晰的比赛名称'"
      /></label>
      <div class="form-grid">
        <label
          >来源 / OJ <span class="optional">选填</span
          ><input
            v-model="form.source"
            maxlength="100"
            placeholder="例如：Codeforces、自建 OJ、校内训练" /></label
        ><label
          >来源链接 <span class="optional">选填</span
          ><input
            v-model="form.source_url"
            type="url"
            maxlength="2048"
            placeholder="https://"
        /></label>
      </div>
      <template v-if="!isProblem"
        ><div class="form-grid">
          <label
            >开始时间 <span class="optional">本地时区</span
            ><input
              v-model="form.start_at"
              type="datetime-local"
              required /></label
          ><label
            >结束时间 <span class="optional">本地时区</span
            ><input v-model="form.end_at" type="datetime-local" required
          /></label>
        </div>
        <label
          >比赛介绍 <span class="optional">支持 Markdown</span
          ><textarea
            v-model="form.description"
            rows="6"
            maxlength="20000"
            placeholder="介绍比赛背景、适合人群或其他说明"
          ></textarea></label></template
      ><label v-else
        >题面 <span class="optional">支持 Markdown，或通过来源链接提供题面</span
        ><textarea
          class="code-input"
          v-model="form.statement"
          rows="16"
          maxlength="80000"
          placeholder="# 题目描述"
        ></textarea>
      </label>
    </section>
    <section v-if="!isProblem" class="panel content-panel">
      <div class="section-heading">
        <h2>
          比赛题目 <span class="count-label">{{ form.problems.length }}</span>
        </h2>
        <button type="button" class="btn small" @click="add()">
          <Icon name="plus" :size="16" />新增题目
        </button>
      </div>
      <p class="muted small-note">
        同一道题可复用已有题目，评价会共享。已有成绩时，请先清空成绩再调整题目或满分。
      </p>
      <div class="reuse-search">
        <label
          >从题库复用
          <div class="input-with-button">
            <input
              v-model="search"
              placeholder="搜索已有题目名称或来源"
              maxlength="100"
              @keydown.enter.prevent="searchProblems"
            /><button type="button" class="btn" @click="searchProblems">
              搜索
            </button>
          </div></label
        >
        <p v-if="searchError" class="muted small-note">{{ searchError }}</p>
        <div v-if="matches.length" class="search-results">
          <button
            v-for="p in matches"
            :key="p.id"
            type="button"
            :disabled="form.problems.some((x: Item) => x.id === p.id)"
            @click="add(p)"
          >
            <strong>{{ p.title }}</strong
            ><span>{{ p.source || "自主上传" }}</span
            ><Icon name="plus" :size="16" />
          </button>
        </div>
      </div>
      <article
        class="problem-editor"
        v-for="(p, index) in form.problems"
        :key="index"
      >
        <div class="problem-editor-top">
          <strong>题目 {{ index + 1 }}</strong
          ><span v-if="p.id" class="badge approved">复用题库</span>
          <div class="button-row">
            <button
              type="button"
              class="text-btn"
              :disabled="index === 0"
              @click="move(index, -1)"
            >
              上移</button
            ><button
              type="button"
              class="text-btn"
              :disabled="index === form.problems.length - 1"
              @click="move(index, 1)"
            >
              下移</button
            ><button
              type="button"
              class="icon-btn"
              :disabled="form.problems.length === 1"
              :aria-label="`移除第${index + 1}题`"
              @click="form.problems.splice(index, 1)"
            >
              <Icon name="close" :size="17" />
            </button>
          </div>
        </div>
        <div class="problem-fields">
          <label
            >题号<input
              v-model="p.label"
              required
              maxlength="16"
              pattern="[A-Za-z0-9_-]+" /></label
          ><label
            >题目名称<input
              v-model="p.title"
              :readonly="!!p.id"
              :required="!p.id"
              maxlength="160"
              placeholder="输入题目名称" /></label
          ><label
            >满分<input
              v-model.number="p.max_score"
              type="number"
              required
              min="0.01"
              max="100000"
              step="0.01"
          /></label>
        </div>
        <RouterLink
          v-if="p.id"
          class="text-link small-note"
          :to="`/admin/problems/${p.id}/edit`"
          >编辑共享题面（请先保存当前表单）<Icon name="arrow" :size="14"
        /></RouterLink>
        <details v-else>
          <summary>补充题面与来源</summary>
          <div class="form-grid">
            <label>题目来源<input v-model="p.source" maxlength="100" /></label
            ><label
              >题目链接<input
                v-model="p.source_url"
                type="url"
                maxlength="2048"
                placeholder="https://"
            /></label>
          </div>
          <label
            >题面 Markdown<textarea
              v-model="p.statement"
              rows="6"
              maxlength="80000"
            ></textarea>
          </label>
        </details>
      </article>
    </section>
    <section class="panel content-panel">
      <h2>发布设置</h2>
      <label
        >公开状态<select v-model="form.status">
          <option value="draft">草稿 · 仅管理员可见</option>
          <option value="published">公开 · 允许评价</option>
          <option value="archived">归档 · 只读保留</option>
        </select></label
      >
      <p v-if="!isProblem" class="muted small-note">
        公开比赛会同时公开关联的草稿题目。比赛结束后允许评价。
      </p>
      <label v-if="!isProblem" class="check-label"
        ><input v-model="form.rated" type="checkbox" />启用竞技
        Rating（导入成绩后在管理台统一结算）</label
      >
      <p v-if="error" class="error-box" role="alert">{{ error }}</p>
      <div class="form-actions">
        <RouterLink class="btn" :to="id ? `/${kind}/${id}` : '/admin'"
          >取消</RouterLink
        ><button class="btn primary" :disabled="busy">
          {{
            busy
              ? "正在保存…"
              : form.status === "draft"
                ? "保存草稿"
                : "保存并更新"
          }}
        </button>
      </div>
    </section>
  </form>
  <section class="panel content-panel top-space" v-if="allowed && id">
    <Attachments
      :kind="kind"
      :id="id"
      :files="files"
      editable
      @updated="load"
    />
  </section>
  <p class="muted small-note" v-else-if="allowed">
    保存后可在编辑页面上传 PDF 附件。成绩 CSV 在比赛详情的「成绩榜」中导入。
  </p>
</template>

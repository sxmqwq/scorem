<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import {
  api,
  auth,
  refreshUser,
  useTask,
  statusLabel,
  dateTime,
  toast,
  type Item,
  type Page,
} from "../api";
import Icon from "../components/Icon.vue";
import Pagination from "../components/Pagination.vue";
const tab = ref("users"),
  status = ref("pending"),
  q = ref(""),
  data = ref<Page>({ items: [], total: 0, page: 1, pageSize: 20 });
const { busy, error, run } = useTask();
const allowed = computed(
  () => auth.user?.role === "admin" && auth.user.status === "approved",
);
const selected = ref<Item | null>(null),
  dialog = ref<HTMLDialogElement>();
const rating = ref<any>(null),
  dirty = ref(false),
  running = ref(false),
  ratingError = ref("");
let mounted = true;
const progress = computed(() => {
  const r = rating.value;
  if (!r) return 0;
  return r.status === "completed"
    ? 100
    : r.totalContests
      ? Math.min(
          99,
          ((r.finishedContests +
            (r.participants ? r.cursor / r.participants : 0)) /
            r.totalContests) *
            100,
        )
      : 0;
});
async function load(page = 1) {
  await run(async () => {
    if (!auth.user) await refreshUser();
    if (!allowed.value) return;
    const params = new URLSearchParams({ q: q.value, page: String(page) });
    if (tab.value === "ratings") {
      const r = await api("/api/admin/ratings");
      rating.value = r.run;
      dirty.value = r.dirty;
      return;
    }
    if (tab.value === "users") {
      params.set("status", status.value);
      data.value = await api("/api/admin/users?" + params);
    } else if (tab.value === "audit")
      data.value = await api("/api/admin/audit?" + params);
    else {
      params.set("all", "1");
      data.value = await api("/api/" + tab.value + "?" + params);
    }
  });
}
async function switchTab(value: string) {
  tab.value = value;
  q.value = "";
  error.value = "";
  await load();
}
function manage(user: Item) {
  selected.value = { ...user, reason: user.review_reason || "" };
  dialog.value?.showModal();
}
async function review(user: Item, quick = false) {
  await run(async () => {
    await api(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      json: {
        status: quick ? "approved" : user.status,
        role: user.role,
        reason: quick ? "" : user.reason,
      },
    });
    dialog.value?.close();
    toast("审核结果已保存");
    const params = new URLSearchParams({
      q: q.value,
      page: String(data.value.page),
      status: status.value,
    });
    data.value = await api("/api/admin/users?" + params);
  });
}
async function startRating() {
  await run(async () => {
    rating.value = await api("/api/admin/ratings", {
      method: "POST",
      json: {},
    });
  });
  if (rating.value?.status === "running") await resume();
}
async function resume() {
  if (running.value) return;
  running.value = true;
  ratingError.value = "";
  try {
    while (running.value && mounted && rating.value?.status === "running") {
      rating.value = await api(`/api/admin/ratings/${rating.value.id}/step`, {
        method: "POST",
        json: { version: rating.value.version },
      });
      if (rating.value.status === "completed") {
        dirty.value = false;
        toast("Rating 已全部更新");
        break;
      }
      await new Promise((r) => setTimeout(r, 850));
    }
  } catch (e) {
    ratingError.value = (e as Error).message;
  } finally {
    running.value = false;
  }
}
async function cancelRating() {
  if (!window.confirm("取消本次重算？已发布的 Rating 保持原样。")) return;
  running.value = false;
  await run(async () => {
    await api(`/api/admin/ratings/${rating.value.id}/cancel`, {
      method: "POST",
      json: {},
    });
    const r = await api("/api/admin/ratings");
    rating.value = r.run;
    dirty.value = r.dirty;
    toast("重算已取消");
  });
}
onMounted(() => load());
onUnmounted(() => {
  mounted = false;
  running.value = false;
});
</script>
<template>
  <section class="page-intro">
    <div class="eyebrow"><span></span>ADMIN WORKSPACE</div>
    <h1>让社区有序生长。</h1>
    <p class="lead">审核成员、整理比赛与题目，管理真实可靠的评价。</p>
  </section>
  <p v-if="error" class="error-box" role="alert">
    {{ error }} <button class="text-btn" @click="load()">重新加载</button>
  </p>
  <section v-if="!allowed && !busy" class="panel empty-state">
    <Icon name="shield" :size="34" />
    <h2>此页面需要管理员权限</h2>
    <RouterLink v-if="!auth.user" to="/login" class="btn primary"
      >登录管理员账号</RouterLink
    ><RouterLink v-else to="/account" class="btn">查看账号状态</RouterLink>
  </section>
  <template v-if="allowed"
    ><nav class="content-tabs admin-tabs" aria-label="管理功能">
      <button
        v-for="t in [
          { id: 'users', name: '成员审核' },
          { id: 'contests', name: '比赛管理' },
          { id: 'problems', name: '题目管理' },
          { id: 'ratings', name: 'Rating 结算' },
          { id: 'audit', name: '操作日志' },
        ]"
        :key="t.id"
        :class="{ active: tab === t.id }"
        :disabled="busy"
        @click="switchTab(t.id)"
      >
        {{ t.name }}
      </button>
    </nav>
    <section v-if="tab === 'ratings'" class="panel content-panel rating-job">
      <div class="section-heading">
        <h2>重算竞技 Rating</h2>
        <span class="badge" :class="{ approved: !dirty }">{{
          dirty ? "有待结算数据" : "已同步"
        }}</span>
      </div>
      <p class="muted">
        按比赛结束时间依次计算所有已结束、公开且启用 Rating
        的比赛。只统计关联账号且得分大于 0 的选手，同分采用平均名次。
      </p>
      <div class="info-box">
        重算期间暂停修改比赛和成绩；评分与浏览照常。可以暂停后离开，下次从当前进度继续，全部完成后统一更新公开榜单。
      </div>
      <div v-if="rating" class="job-progress">
        <div>
          <strong>{{
            rating.status === "running"
              ? rating.currentContest || "准备完成"
              : rating.status === "completed"
                ? "上次结算已完成"
                : "上次结算已取消"
          }}</strong
          ><span
            >{{ rating.finishedContests }} / {{ rating.totalContests }} 场</span
          >
        </div>
        <progress :value="progress" max="100">{{ progress }}%</progress>
        <p class="muted small-note">
          已处理 {{ rating.processed }} 份参赛记录<span
            v-if="rating.participants"
          >
            · 当前比赛 {{ rating.cursor }} / {{ rating.participants }}</span
          >
        </p>
      </div>
      <p class="error-box" v-if="ratingError" role="alert">
        {{ ratingError }}。可刷新进度后继续。
      </p>
      <div class="button-row">
        <button
          v-if="rating?.status !== 'running'"
          class="btn primary"
          :disabled="busy"
          @click="startRating"
        >
          开始重算</button
        ><template v-else
          ><button
            v-if="!running"
            class="btn primary"
            :disabled="busy"
            @click="resume"
          >
            继续重算</button
          ><button v-else class="btn" @click="running = false">暂停</button
          ><button class="btn danger" :disabled="busy" @click="cancelRating">
            取消任务
          </button></template
        ><button class="btn" :disabled="busy || running" @click="load()">
          刷新进度
        </button>
      </div>
    </section>
    <section v-else class="panel">
      <form class="filter-bar" @submit.prevent="load()">
        <div class="button-row">
          <h2>
            {{
              tab === "users"
                ? "成员申请"
                : tab === "contests"
                  ? "所有比赛"
                  : tab === "problems"
                    ? "所有题目"
                    : "管理操作记录"
            }}
          </h2>
          <select
            v-if="tab === 'users'"
            v-model="status"
            @change="load()"
            aria-label="审核状态"
          >
            <option value="pending">等待审核</option>
            <option value="approved">已通过</option>
            <option value="rejected">未通过</option>
            <option value="disabled">已停用</option>
            <option value="all">所有用户</option>
          </select>
        </div>
        <div class="filter-controls">
          <div v-if="tab !== 'audit'" class="search-field">
            <Icon name="search" :size="17" /><input
              v-model="q"
              aria-label="搜索管理记录"
              placeholder="搜索…"
              maxlength="100"
            /><button class="search-submit" aria-label="搜索">
              <Icon name="arrow" :size="16" />
            </button>
          </div>
          <RouterLink
            v-if="['contests', 'problems'].includes(tab)"
            :to="`/admin/${tab}/new`"
            class="btn primary small"
            ><Icon name="plus" :size="16" />新增</RouterLink
          >
        </div>
      </form>
      <div v-if="busy" class="loading-state">正在加载…</div>
      <div v-else-if="!data.items.length" class="empty-state">
        <Icon name="check" :size="30" />
        <h3>
          {{
            tab === "users" && status === "pending"
              ? "暂时没有待审核申请"
              : "这里还没有记录"
          }}
        </h3>
        <p>
          {{
            tab === "users"
              ? "新申请会显示在这里。"
              : "新增内容后即可在这里管理。"
          }}
        </p>
      </div>
      <div v-else class="table-wrap">
        <table v-if="tab === 'users'">
          <thead>
            <tr>
              <th>成员</th>
              <th>申请说明</th>
              <th>状态</th>
              <th>提交时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in data.items" :key="u.id">
              <td>
                <strong>{{ u.nickname }}</strong
                ><small class="block muted"
                  >@{{ u.username }}
                  {{ u.role === "admin" ? "· 管理员" : "" }}</small
                >
              </td>
              <td class="application-text">{{ u.application || "未填写" }}</td>
              <td>
                <span class="badge" :class="u.status">{{
                  statusLabel(u.status)
                }}</span>
              </td>
              <td class="date-cell">{{ dateTime(u.created_at) }}</td>
              <td>
                <div class="button-row">
                  <button
                    v-if="u.status === 'pending'"
                    class="btn primary small"
                    :disabled="busy"
                    @click="review(u, true)"
                  >
                    通过</button
                  ><button
                    class="btn small"
                    :disabled="u.id === auth.user?.id || busy"
                    @click="manage(u)"
                  >
                    {{ u.status === "pending" ? "审核" : "管理" }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <table v-else-if="tab === 'audit'">
          <thead>
            <tr>
              <th>时间</th>
              <th>操作人</th>
              <th>操作</th>
              <th>详情</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in data.items" :key="log.id">
              <td class="date-cell">{{ dateTime(log.created_at) }}</td>
              <td>{{ log.username }}</td>
              <td>
                <code>{{ log.action }}</code>
              </td>
              <td>
                <details>
                  <summary>查看记录</summary>
                  <p class="mono">{{ log.target_id }}</p>
                  <pre>{{
                    JSON.stringify(JSON.parse(log.details), null, 2)
                  }}</pre>
                </details>
              </td>
            </tr>
          </tbody>
        </table>
        <table v-else>
          <thead>
            <tr>
              <th>名称</th>
              <th>来源</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in data.items" :key="item.id">
              <td>
                <RouterLink class="strong" :to="`/${tab}/${item.id}`">{{
                  item.title
                }}</RouterLink
                ><small class="block muted mono">{{ item.id }}</small>
              </td>
              <td>{{ item.source || "自主上传" }}</td>
              <td>
                <span class="badge" :class="item.status">{{
                  statusLabel(item.status)
                }}</span>
              </td>
              <td>
                <RouterLink
                  class="btn small"
                  :to="`/admin/${tab}/${item.id}/edit`"
                  >编辑</RouterLink
                >
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <Pagination v-bind="data" @change="load" />
    </section>
    <dialog ref="dialog" class="modal">
      <form v-if="selected" @submit.prevent="review(selected)">
        <div class="section-heading">
          <h2>管理 {{ selected.nickname }}</h2>
          <button
            type="button"
            class="icon-btn"
            aria-label="关闭审核窗口"
            @click="dialog?.close()"
          >
            <Icon name="close" />
          </button>
        </div>
        <p class="muted">@{{ selected.username }}</p>
        <p class="application-box">
          {{ selected.application || "没有填写申请说明" }}
        </p>
        <label
          >账号状态<select v-model="selected.status">
            <option value="pending">等待审核</option>
            <option value="approved">通过审核</option>
            <option value="rejected">拒绝申请</option>
            <option value="disabled">停用账号</option>
          </select></label
        ><label
          >角色<select v-model="selected.role">
            <option value="member">普通成员</option>
            <option value="admin">管理员</option>
          </select></label
        ><label
          >审核说明<textarea
            v-model="selected.reason"
            rows="3"
            maxlength="500"
            :required="['rejected', 'disabled'].includes(selected.status)"
            placeholder="拒绝或停用时必填，用户可查看此说明"
          ></textarea>
        </label>
        <p v-if="error" class="error-box" role="alert">{{ error }}</p>
        <div class="form-actions">
          <button type="button" class="btn" @click="dialog?.close()">
            取消</button
          ><button class="btn primary" :disabled="busy">保存审核结果</button>
        </div>
      </form>
    </dialog></template
  >
</template>

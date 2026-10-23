<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import {
  api,
  auth,
  refreshUser,
  setSession,
  useTask,
  statusLabel,
  toast,
  quality,
  type Page,
} from "../api";
import { deriveProof } from "../password.mjs";
import Icon from "../components/Icon.vue";
import Pagination from "../components/Pagination.vue";
const router = useRouter(),
  nickname = ref(""),
  currentPassword = ref(""),
  newPassword = ref(""),
  confirm = ref("");
const data = ref<Page>({ items: [], total: 0, page: 1, pageSize: 20 });
const { busy, error, run } = useTask();
async function load(page = 1) {
  await run(async () => {
    await refreshUser();
    nickname.value = auth.user?.nickname || "";
    if (auth.user) data.value = await api("/api/me/reviews?page=" + page);
  });
}
onMounted(() => load());
async function profile() {
  await run(async () => {
    const r = await api("/api/auth/profile", {
      method: "PATCH",
      json: { nickname: nickname.value },
    });
    auth.user = r.user;
    toast("昵称已更新");
  });
}
async function password() {
  await run(async () => {
    if (!auth.user) return;
    if (newPassword.value.length < 12 || newPassword.value.length > 128)
      throw Error("新密码需要 12–128 个字符");
    if (newPassword.value !== confirm.value) throw Error("两次新密码不一致");
    const c = await api(
      "/api/auth/challenge?username=" + encodeURIComponent(auth.user.username),
    );
    const currentProof = await deriveProof(currentPassword.value, c),
      newProof = await deriveProof(newPassword.value, c);
    await api("/api/auth/password", {
      method: "POST",
      json: { currentProof, newProof },
    });
    currentPassword.value = "";
    newPassword.value = "";
    confirm.value = "";
    setSession(null);
    toast("密码已修改，请重新登录");
    router.push("/login");
  });
}
</script>
<template>
  <section class="page-intro">
    <div class="eyebrow"><span></span>YOUR SPACE</div>
    <h1>记录你的思考。</h1>
    <p class="lead">管理账号、查看申请状态，回顾你留下的每一份评价。</p>
  </section>
  <p v-if="error" class="error-box" role="alert">
    {{ error }} <button class="text-btn" @click="load()">重试</button>
  </p>
  <section v-if="!auth.user" class="panel empty-state">
    <Icon name="user" :size="34" />
    <h2>登录后进入你的空间</h2>
    <p>已有账号可以直接登录，新成员需要先提交注册申请。</p>
    <div class="button-row">
      <RouterLink to="/login" class="btn primary">登录</RouterLink
      ><RouterLink to="/register" class="btn">注册申请</RouterLink>
    </div>
  </section>
  <template v-else
    ><section class="account-status" :class="auth.user.status">
      <Icon name="shield" :size="25" />
      <div>
        <strong>账号状态：{{ statusLabel(auth.user.status) }}</strong>
        <p>
          {{
            auth.user.status === "approved"
              ? "你可以为公开的比赛和题目评分，分享自己的体验。"
              : auth.user.status === "pending"
                ? "申请已提交，管理员审核后即可参与评分。等待期间可以浏览比赛和题目。"
                : auth.user.review_reason || "请联系管理员了解审核结果。"
          }}
        </p>
        <p
          v-if="auth.user.review_reason && auth.user.status === 'approved'"
          class="small-note"
        >
          审核说明：{{ auth.user.review_reason }}
        </p>
      </div>
      <button class="btn small" :disabled="busy" @click="load()">
        刷新状态
      </button>
    </section>
    <div class="account-layout">
      <section class="panel content-panel">
        <div class="section-heading">
          <h2>
            我的评价 <span class="count-label">{{ data.total }}</span>
          </h2>
          <RouterLink
            v-if="auth.user.status === 'approved'"
            class="text-link"
            :to="`/users/${auth.user.id}`"
            >竞技档案 <Icon name="arrow" :size="16"
          /></RouterLink>
        </div>
        <div v-if="!data.items.length" class="empty-state compact">
          <Icon name="message" :size="30" />
          <h3>还没有留下评价</h3>
          <p>从一场熟悉的比赛或一道喜欢的题目开始。</p>
          <RouterLink class="btn small" to="/contests">发现比赛</RouterLink>
        </div>
        <RouterLink
          v-for="r in data.items"
          :key="r.id"
          class="my-review-row"
          :to="`/${r.target_type === 'contest' ? 'contests' : 'problems'}/${r.target_id}`"
          ><span
            ><small class="muted"
              >{{ r.target_type === "contest" ? "比赛" : "题目"
              }}<span v-if="r.hidden"> · 已隐藏</span></small
            ><strong>{{ r.title }}</strong>
            <p v-if="r.body">{{ r.body.slice(0, 100) }}</p></span
          ><span class="review-score"
            >{{ quality(r.quality)
            }}<Icon name="star" :size="16" /></span></RouterLink
        ><Pagination v-bind="data" @change="load" />
      </section>
      <aside>
        <section class="panel content-panel">
          <h2>个人资料</h2>
          <form @submit.prevent="profile">
            <label>用户名<input :value="auth.user.username" disabled /></label
            ><label
              >昵称<input v-model="nickname" required maxlength="40" /></label
            ><button class="btn full" :disabled="busy">保存昵称</button>
          </form>
          <details class="password-settings">
            <summary>修改密码</summary>
            <form @submit.prevent="password">
              <label
                >当前密码<input
                  v-model="currentPassword"
                  type="password"
                  autocomplete="current-password"
                  required
                  maxlength="128" /></label
              ><label
                >新密码<input
                  v-model="newPassword"
                  type="password"
                  autocomplete="new-password"
                  required
                  minlength="12"
                  maxlength="128" /></label
              ><label
                >确认新密码<input
                  v-model="confirm"
                  type="password"
                  autocomplete="new-password"
                  required
                  minlength="12"
                  maxlength="128" /></label
              ><button class="btn full" :disabled="busy">修改并重新登录</button>
            </form>
          </details>
        </section>
        <RouterLink
          v-if="auth.user.role === 'admin'"
          class="admin-shortcut"
          to="/admin"
          ><Icon name="shield" />进入管理工作台<Icon name="arrow" :size="18"
        /></RouterLink>
      </aside></div
  ></template>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { auth, refreshUser, logout, notification } from "./api";
import Icon from "./components/Icon.vue";
const route = useRoute(),
  router = useRouter();
const admin = computed(
  () => auth.user?.role === "admin" && auth.user.status === "approved",
);
const section = computed(() =>
  route.path.startsWith("/admin")
    ? "管理工作台"
    : route.path.startsWith("/problems")
      ? "题目题库"
      : route.path.startsWith("/users")
        ? "Rating 排行"
        : route.path === "/account"
          ? "我的空间"
          : "比赛广场",
);
function restoreLogin() {
  void refreshUser().catch(() => {});
}
onMounted(() => {
  if (auth.token) restoreLogin();
});
async function signOut() {
  await logout().catch(() => {});
  router.push("/contests");
}
function skipToContent() {
  const main = document.getElementById("main");
  main?.focus();
  main?.scrollIntoView({ block: "start" });
}
</script>
<template>
  <a class="skip-link" href="#main" @click.prevent="skipToContent"
    >跳转到主要内容</a
  >
  <aside class="sidebar">
    <RouterLink class="brand" to="/contests" aria-label="scorem 首页"
      ><span class="brand-mark"><i></i><i></i><i></i></span>scorem<span
        class="brand-dot"
        >.</span
      ></RouterLink
    >
    <div class="nav-label">探索社区</div>
    <nav class="primary-nav" aria-label="主导航">
      <RouterLink to="/contests"><Icon name="trophy" />比赛广场</RouterLink
      ><RouterLink to="/problems"><Icon name="book" />题目题库</RouterLink
      ><RouterLink to="/users"><Icon name="chart" />Rating 排行</RouterLink>
    </nav>
    <div class="nav-label second-label">我的工作区</div>
    <nav class="primary-nav" aria-label="工作区">
      <RouterLink to="/account"><Icon name="message" />我的评分</RouterLink
      ><RouterLink v-if="admin" to="/admin"
        ><Icon name="shield" />管理工作台</RouterLink
      >
    </nav>
    <div class="sidebar-note">
      <span class="tiny-orbit">✳</span><strong>不止于一个分数</strong>
      <p>记录思考，交流体验。<br />发现值得参加的下一场比赛。</p>
      <span class="small-note">独立评价 · 开放分享</span>
    </div>
    <div class="sidebar-user" v-if="auth.user">
      <span class="avatar">{{ auth.user.nickname.slice(0, 1) }}</span
      ><RouterLink to="/account"
        ><strong>{{ auth.user.nickname }}</strong
        ><small>{{ admin ? "管理员" : "社区成员" }}</small></RouterLink
      ><button class="icon-btn" aria-label="退出登录" @click="signOut">
        <Icon name="logout" :size="17" />
      </button>
    </div>
    <button
      v-else-if="auth.token"
      class="sidebar-join"
      :disabled="!auth.ready"
      @click="restoreLogin"
    >
      <Icon name="user" :size="18" />{{
        auth.ready ? "重试连接" : "恢复登录中…"
      }}
    </button>
    <RouterLink v-else class="sidebar-join" to="/register"
      ><Icon name="user" :size="18" />加入 scorem <Icon name="arrow" :size="16"
    /></RouterLink>
  </aside>
  <div class="main-shell">
    <header class="topbar">
      <span class="breadcrumb"
        >社区 <span>/</span> <strong>{{ section }}</strong></span
      >
      <div class="top-actions">
        <span class="community-dot">算法竞赛评价社区</span
        ><button
          v-if="auth.token && !auth.user"
          class="btn small"
          :disabled="!auth.ready"
          @click="restoreLogin"
        >
          {{ auth.ready ? "重试连接" : "恢复登录中…" }}</button
        ><RouterLink v-else-if="!auth.user" class="btn small" to="/login"
          >登录</RouterLink
        ><RouterLink
          v-else
          class="mini-avatar"
          to="/account"
          :aria-label="auth.user.nickname + '的个人空间'"
          >{{ auth.user.nickname.slice(0, 1) }}</RouterLink
        >
      </div>
    </header>
    <main id="main" tabindex="-1">
      <RouterView :key="route.path + ':' + (auth.user?.id || 'guest')" />
    </main>
    <footer class="footer">
      <span><strong>scorem.</strong> 让好的题目被看见。</span
      ><span>质量评价与竞技 Rating 独立计算</span>
    </footer>
  </div>
  <div v-if="notification" class="toast" role="status">
    <Icon name="check" :size="18" />{{ notification }}
  </div>
</template>

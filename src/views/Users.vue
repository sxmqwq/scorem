<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api, useTask, type Page } from "../api";
import Icon from "../components/Icon.vue";
import Pagination from "../components/Pagination.vue";
const data = ref<Page>({ items: [], total: 0, page: 1, pageSize: 20 }),
  q = ref("");
const { busy, error, run } = useTask();
function load(page = 1) {
  return run(
    async () =>
      (data.value = await api(
        "/api/users?" + new URLSearchParams({ q: q.value, page: String(page) }),
      )),
  );
}
onMounted(() => load());
</script>
<template>
  <section class="page-intro">
    <div class="eyebrow"><span></span>COMMUNITY RATING</div>
    <h1>每一次出发，留下进步的轨迹。</h1>
    <p class="lead">根据比赛成绩计算竞技 Rating，从 1500 开始记录成长。</p>
  </section>
  <div class="info-box" v-if="data.ratingsDirty">
    有新的比赛或成绩尚未结算，当前展示最近一次完整的 Rating 结果。
  </div>
  <section class="panel">
    <form class="filter-bar" @submit.prevent="load()">
      <h2>
        Rating 排行 <span class="count-label">{{ data.total }}</span>
      </h2>
      <div class="search-field">
        <Icon name="search" :size="17" /><input
          v-model="q"
          placeholder="搜索用户名或昵称…"
          aria-label="搜索成员"
          maxlength="100"
        /><button class="search-submit" type="submit" aria-label="搜索">
          <Icon name="arrow" :size="16" />
        </button>
      </div>
    </form>
    <div v-if="error" class="empty-state">
      <p role="alert">{{ error }}</p>
      <button class="btn" @click="load()">重试</button>
    </div>
    <div v-else-if="busy" class="loading-state">正在加载排行…</div>
    <div v-else-if="!data.items.length" class="empty-state">
      <Icon name="user" :size="32" />
      <h3>还没有匹配的成员</h3>
      <p>通过审核的用户会出现在这里。</p>
    </div>
    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>排名</th>
            <th>成员</th>
            <th>Rating</th>
            <th>计分场次</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(u, i) in data.items" :key="u.id">
            <td>
              <span
                class="rank"
                :class="{ 'top-rank': data.page === 1 && i < 3 }"
                >{{
                  String((data.page - 1) * data.pageSize + i + 1).padStart(
                    2,
                    "0",
                  )
                }}</span
              >
            </td>
            <td>
              <RouterLink class="review-author" :to="`/users/${u.id}`"
                ><span class="avatar">{{ u.nickname.slice(0, 1) }}</span
                ><span
                  ><strong>{{ u.nickname }}</strong
                  ><small class="block muted">@{{ u.username }}</small></span
                ></RouterLink
              >
            </td>
            <td>
              <strong class="rating-value">{{ u.rating }}</strong>
            </td>
            <td>{{ u.rated_contests }} <span class="muted">场</span></td>
            <td>
              <RouterLink
                class="icon-btn"
                :to="`/users/${u.id}`"
                :aria-label="`查看${u.nickname}`"
                ><Icon name="arrow" :size="17"
              /></RouterLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <Pagination v-bind="data" @change="load" />
  </section>
  <div class="bottom-note">
    <Icon name="shield" :size="17" />竞技 Rating
    与质量评分独立，不影响评价权重。未参与计分比赛的成员显示初始分。
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { api, auth, date, quality, type Page, useTask } from "../api";
import Icon from "../components/Icon.vue";
import Pagination from "../components/Pagination.vue";
const route = useRoute(),
  isProblem = computed(() => route.path === "/problems"),
  kind = computed(() => (isProblem.value ? "problems" : "contests"));
const data = ref<Page>({ items: [], total: 0, page: 1, pageSize: 20 }),
  stats = ref<any>(null),
  q = ref(""),
  sort = ref("latest"),
  filter = ref("");
const { busy, error, run } = useTask();
const isAdmin = computed(
  () => auth.user?.role === "admin" && auth.user.status === "approved",
);
function load(page = 1) {
  return run(async () => {
    data.value = await api(
      `/api/${kind.value}?` +
        new URLSearchParams({
          q: q.value,
          sort: sort.value,
          status: filter.value,
          page: String(page),
        }),
    );
  });
}
onMounted(() => {
  load();
  api("/api/stats")
    .then((r) => (stats.value = r))
    .catch(() => {});
});
const phase = (item: any) =>
  item.status === "archived"
    ? "已归档"
    : Date.now() < Date.parse(item.start_at)
      ? "未开始"
      : Date.now() < Date.parse(item.end_at)
        ? "进行中"
        : "已结束";
</script>
<template>
  <section class="page-intro">
    <div class="eyebrow">
      <span></span
      >{{ isProblem ? "PROBLEM LIBRARY" : "THE CONTEST COLLECTION" }}
    </div>
    <div class="title-row">
      <div>
        <h1>
          {{
            isProblem ? "好题，值得再遇见。" : "每一场比赛，都值得被认真评价。"
          }}
        </h1>
        <p class="lead">
          {{
            isProblem
              ? "探索不同 OJ 的题目，记录独立的质量与难度评价。"
              : "跨越 OJ 的边界，分享比赛体验，找到值得投入的下一场。"
          }}
        </p>
      </div>
      <RouterLink v-if="isAdmin" :to="`/admin/${kind}/new`" class="btn primary"
        ><Icon name="plus" :size="18" />{{
          isProblem ? "添加题目" : "添加比赛"
        }}</RouterLink
      >
    </div>
  </section>
  <section class="stats-strip" aria-label="社区统计">
    <div>
      <Icon name="trophy" /><span
        >收录比赛<strong
          >{{ stats?.contests ?? "—" }}<small>场</small></strong
        ></span
      >
    </div>
    <div>
      <Icon name="book" /><span
        >独立题目<strong
          >{{ stats?.problems ?? "—" }}<small>道</small></strong
        ></span
      >
    </div>
    <div>
      <Icon name="message" /><span
        >真实评价<strong
          >{{ stats?.reviews ?? "—" }}<small>份</small></strong
        ></span
      >
    </div>
    <div>
      <Icon name="user" /><span
        >社区成员<strong
          >{{ stats?.members ?? "—" }}<small>位</small></strong
        ></span
      >
    </div>
  </section>
  <div class="section-heading">
    <h2>
      {{ isProblem ? "题目题库" : "发现比赛"
      }}<span class="count-label">{{ data.total }}</span>
    </h2>
    <span class="muted small-note">{{
      isProblem ? "一题多场，评价共享" : "质量评分 · 满分 5 分"
    }}</span>
  </div>
  <section class="panel catalog-panel">
    <form class="filter-bar" @submit.prevent="load()">
      <div class="filter-tabs">
        <button
          type="button"
          :class="{ active: filter === '' }"
          @click="
            filter = '';
            load();
          "
        >
          全部</button
        ><button
          type="button"
          :class="{ active: filter === 'published' }"
          @click="
            filter = 'published';
            load();
          "
        >
          已公开</button
        ><button
          type="button"
          :class="{ active: filter === 'archived' }"
          @click="
            filter = 'archived';
            load();
          "
        >
          已归档
        </button>
      </div>
      <div class="filter-controls">
        <div class="search-field">
          <Icon name="search" :size="17" /><input
            v-model="q"
            :placeholder="isProblem ? '搜索题目或来源…' : '搜索比赛或来源…'"
            aria-label="搜索名称或来源"
            maxlength="100"
          /><button class="search-submit" aria-label="搜索" type="submit">
            <Icon name="arrow" :size="16" />
          </button>
        </div>
        <select v-model="sort" aria-label="排序方式" @change="load()">
          <option value="latest">最近收录</option>
          <option value="quality">评分最高</option>
          <option value="popular">评价最多</option>
          <option v-if="isProblem" value="difficulty">难度最高</option>
        </select>
      </div>
    </form>
    <div v-if="error" class="empty-state">
      <Icon name="link" :size="34" />
      <h3>暂时无法加载</h3>
      <p role="alert">{{ error }}</p>
      <button class="btn" @click="load()">重新加载</button>
    </div>
    <div v-else-if="busy" class="loading-state" role="status">
      <span class="spinner"></span>正在寻找值得一看的内容…
    </div>
    <div v-else-if="!data.items.length" class="empty-state">
      <span class="empty-symbol"
        ><Icon :name="isProblem ? 'book' : 'trophy'" :size="32"
      /></span>
      <h3>{{ q || filter ? "还没有匹配的结果" : "从第一份分享开始" }}</h3>
      <p>
        {{
          q || filter
            ? "换一个关键词，或查看全部内容。"
            : isProblem
              ? "管理员添加题目后，就可以在这里浏览和评价。"
              : "管理员上传比赛后，每个人都能在这里发现和讨论。"
        }}
      </p>
      <RouterLink
        v-if="isAdmin && !q"
        class="btn primary"
        :to="`/admin/${kind}/new`"
        >{{ isProblem ? "添加第一道题目" : "添加第一场比赛"
        }}<Icon name="arrow" :size="16" /></RouterLink
      ><button
        v-if="q || filter"
        class="btn"
        @click="
          q = '';
          filter = '';
          load();
        "
      >
        查看全部
      </button>
    </div>
    <div v-else class="table-wrap">
      <table class="catalog-table">
        <thead>
          <tr>
            <th>{{ isProblem ? "题目" : "比赛" }}</th>
            <th>来源</th>
            <th>{{ isProblem ? "难度" : "题目数" }}</th>
            <th>社区评分</th>
            <th>{{ isProblem ? "收录时间" : "比赛日期" }}</th>
            <th><span class="sr-only">查看</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, index) in data.items" :key="item.id">
            <td>
              <RouterLink class="item-title" :to="`/${kind}/${item.id}`"
                ><span class="item-icon" :class="`tint-${index % 4}`"
                  ><Icon
                    :name="isProblem ? 'book' : 'trophy'"
                    :size="22" /></span
                ><span
                  ><strong>{{ item.title }}</strong
                  ><span class="item-meta"
                    ><span
                      v-if="!isProblem"
                      class="status-dot"
                      :class="{ live: phase(item) === '进行中' }"
                      >{{ phase(item) }}</span
                    ><span v-else>独立题目</span
                    ><span v-if="item.rated" class="rated-label"
                      >RATED</span
                    ></span
                  ></span
                ></RouterLink
              >
            </td>
            <td>
              <span class="source-tag">{{ item.source || "自主上传" }}</span>
            </td>
            <td class="mono">
              {{
                isProblem
                  ? item.difficulty == null
                    ? "—"
                    : item.difficulty + " / 10"
                  : String(item.problem_count).padStart(2, "0")
              }}
            </td>
            <td>
              <div class="score-cell">
                <Icon name="star" :size="15" /><strong>{{
                  quality(item.quality)
                }}</strong
                ><small>{{ item.votes }} 人评价</small>
              </div>
            </td>
            <td class="date-cell">
              {{ date(isProblem ? item.created_at : item.start_at) }}
            </td>
            <td>
              <RouterLink
                class="icon-btn"
                :to="`/${kind}/${item.id}`"
                :aria-label="`查看${item.title}`"
                ><Icon name="arrow" :size="18"
              /></RouterLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <Pagination v-bind="data" @change="load" />
  </section>
  <div class="bottom-note">
    <Icon name="shield" :size="17" /><span
      >每位成员一份评价，所有评分平等计权。注册通过审核后即可参与。</span
    ><RouterLink v-if="!auth.user" to="/register"
      >加入讨论 <span>↗</span></RouterLink
    >
  </div>
</template>

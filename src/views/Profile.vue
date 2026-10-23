<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { api, date, useTask, type Item } from "../api";
import Icon from "../components/Icon.vue";
const route = useRoute(),
  data = ref<Item | null>(null);
const { busy, error, run } = useTask();
const load = () =>
  run(async () => (data.value = await api(`/api/users/${route.params.id}`)));
onMounted(load);
const chart = computed(() => {
  const values = [
      1500,
      ...(data.value?.history || []).map((r: Item) => r.post_rating),
    ],
    min = Math.min(...values) - 50,
    max = Math.max(...values) + 50;
  const points = values
    .map(
      (v, i) =>
        `${45 + (i * 710) / Math.max(1, values.length - 1)},${190 - ((v - min) / (max - min)) * 150}`,
    )
    .join(" ");
  return {
    points,
    min: Math.floor(min),
    max: Math.ceil(max),
    last: values.at(-1),
  };
});
</script>
<template>
  <RouterLink to="/users" class="back-link"
    ><Icon name="back" :size="17" />返回 Rating 排行</RouterLink
  >
  <p v-if="error" class="error-box" role="alert">
    {{ error }} <button class="text-btn" @click="load">重试</button>
  </p>
  <div v-if="busy" class="loading-state">正在加载成员资料…</div>
  <template v-if="data"
    ><section class="profile-heading">
      <span class="avatar xl">{{ data.nickname.slice(0, 1) }}</span>
      <div>
        <div class="eyebrow">COMMUNITY MEMBER</div>
        <h1>{{ data.nickname }}</h1>
        <p class="muted">
          @{{ data.username }} · {{ date(data.created_at) }} 加入
        </p>
      </div>
      <div class="profile-rating">
        <span class="muted">当前 Rating</span><strong>{{ data.rating }}</strong
        ><small>{{ data.rated_contests }} 场计分比赛</small>
      </div>
    </section>
    <section class="panel content-panel">
      <div class="section-heading">
        <h2>Rating 轨迹</h2>
        <span class="muted small-note">初始分 1500</span>
      </div>
      <svg
        class="rating-chart"
        viewBox="0 0 800 230"
        role="img"
        :aria-label="`${data.nickname}的 Rating 从1500变化至${data.rating}，共${data.history.length}场比赛`"
      >
        <line x1="45" x2="755" y1="40" y2="40" stroke="#e9edf2" />
        <line x1="45" x2="755" y1="115" y2="115" stroke="#e9edf2" />
        <line x1="45" x2="755" y1="190" y2="190" stroke="#e9edf2" />
        <text x="0" y="44">{{ chart.max }}</text>
        <text x="0" y="194">{{ chart.min }}</text>
        <polyline
          :points="chart.points"
          fill="none"
          stroke="#377f6c"
          stroke-width="3"
          stroke-linejoin="round"
        />
        <text x="45" y="220">开始</text>
        <text x="710" y="220">最近</text>
      </svg>
      <p v-if="!data.history.length" class="muted">
        尚未参加计分比赛，期待你的第一场记录。
      </p>
    </section>
    <section class="panel top-space">
      <div class="panel-title"><h2>比赛记录</h2></div>
      <div v-if="!data.history.length" class="empty-state compact">
        <p>管理员关联成绩并完成 Rating 结算后，比赛记录会显示在这里。</p>
      </div>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>比赛</th>
              <th>日期</th>
              <th>总分</th>
              <th>计分组名次</th>
              <th>Rating</th>
              <th>变化</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in [...data.history].reverse()" :key="r.contest_id">
              <td>
                <RouterLink class="strong" :to="`/contests/${r.contest_id}`">{{
                  r.title
                }}</RouterLink>
              </td>
              <td>{{ date(r.end_at) }}</td>
              <td>{{ r.score }}</td>
              <td>{{ r.rank }}</td>
              <td>{{ r.post_rating }}</td>
              <td
                :class="r.post_rating >= r.pre_rating ? 'positive' : 'negative'"
              >
                {{ r.post_rating - r.pre_rating >= 0 ? "+" : ""
                }}{{ r.post_rating - r.pre_rating }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section></template
  >
</template>

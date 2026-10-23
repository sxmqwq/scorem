<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import {
  api,
  auth,
  dateTime,
  quality,
  statusLabel,
  useTask,
  type Item,
} from "../api";
import Icon from "../components/Icon.vue";
import Markdown from "../components/Markdown.vue";
import ReviewPanel from "../components/ReviewPanel.vue";
import Standings from "../components/Standings.vue";
import Attachments from "../components/Attachments.vue";
const route = useRoute(),
  kind = computed(() =>
    route.path.startsWith("/problems") ? "problems" : "contests",
  ),
  isProblem = computed(() => kind.value === "problems");
const item = ref<Item | null>(null),
  tab = ref("content");
const { busy, error, run } = useTask();
const isAdmin = computed(
  () => auth.user?.role === "admin" && auth.user.status === "approved",
);
async function load() {
  await run(
    async () =>
      (item.value = await api(`/api/${kind.value}/${route.params.id}`)),
  );
}
onMounted(load);
function count(score: number) {
  return (
    item.value?.distribution.find((v: Item) => v.quality === score)?.count || 0
  );
}
</script>
<template>
  <RouterLink class="back-link" :to="`/${kind}`"
    ><Icon name="back" :size="17" />返回{{
      isProblem ? "题目题库" : "比赛广场"
    }}</RouterLink
  >
  <div v-if="busy && !item" class="loading-state">正在加载详情…</div>
  <div v-if="error" class="error-box" role="alert">
    {{ error }} <button class="text-btn" @click="load">重试</button>
  </div>
  <template v-if="item"
    ><section class="detail-heading">
      <div class="eyebrow">
        <span></span>{{ isProblem ? "PROBLEM DETAIL" : "CONTEST DETAIL"
        }}<span class="badge" v-if="item.status !== 'published'">{{
          statusLabel(item.status)
        }}</span>
      </div>
      <div class="title-row">
        <h1>{{ item.title }}</h1>
        <RouterLink
          v-if="isAdmin"
          class="btn small"
          :to="`/admin/${kind}/${item.id}/edit`"
          ><Icon name="edit" :size="16" />编辑{{
            isProblem ? "题目" : "比赛"
          }}</RouterLink
        >
      </div>
      <div class="detail-meta">
        <span class="source-tag">{{ item.source || "自主上传" }}</span
        ><span v-if="!isProblem"
          ><Icon name="clock" :size="15" />{{ dateTime(item.start_at) }} —
          {{ dateTime(item.end_at) }}</span
        ><span v-if="item.rated" class="rated-label">RATED</span
        ><a
          v-if="item.source_url"
          :href="item.source_url"
          target="_blank"
          rel="noopener noreferrer"
          class="text-link"
          >查看来源<Icon name="link" :size="14"
        /></a>
      </div>
    </section>
    <div class="detail-layout">
      <div class="detail-main">
        <nav class="content-tabs" aria-label="详情内容">
          <button
            :class="{ active: tab === 'content' }"
            @click="tab = 'content'"
          >
            {{ isProblem ? "题面" : "比赛与题目" }}</button
          ><button
            v-if="!isProblem"
            :class="{ active: tab === 'standings' }"
            @click="tab = 'standings'"
          >
            成绩榜</button
          ><button
            :class="{ active: tab === 'reviews' }"
            @click="tab = 'reviews'"
          >
            社区评价 <span>{{ item.votes }}</span>
          </button>
        </nav>
        <section v-if="tab === 'content'" class="panel content-panel">
          <template v-if="isProblem"
            ><Markdown v-if="item.statement" :text="item.statement" />
            <div v-else class="empty-state compact">
              <Icon name="book" :size="30" />
              <h3>这里还没有录入题面</h3>
              <p>
                {{
                  item.source_url
                    ? "可通过上方「查看来源」阅读原题。"
                    : "管理员可以补充题面、附件或来源链接。"
                }}
              </p>
            </div>
            <Attachments :kind="kind" :id="item.id" :files="item.attachments" />
            <div v-if="item.contests.length" class="related-contests">
              <h3>收录此题的比赛</h3>
              <RouterLink
                v-for="c in item.contests"
                :key="c.id"
                :to="`/contests/${c.id}`"
                ><Icon name="trophy" :size="17" />{{ c.title
                }}<span class="muted">题目 {{ c.label }}</span
                ><Icon name="arrow" :size="16"
              /></RouterLink>
            </div>
            <details class="identifier">
              <summary>题目编号</summary>
              <code>{{ item.id }}</code>
              <p>管理员可使用此编号在其他比赛中复用题目。</p>
            </details></template
          >
          <template v-else
            ><h2>关于这场比赛</h2>
            <Markdown v-if="item.description" :text="item.description" />
            <p v-else class="muted">暂无比赛介绍。</p>
            <Attachments :kind="kind" :id="item.id" :files="item.attachments" />
            <div class="section-heading">
              <h2>比赛题目</h2>
              <span class="muted"
                >{{ item.problems.length }} 道 ·
                {{
                  item.problems.reduce(
                    (s: number, p: Item) => s + p.max_score,
                    0,
                  )
                }}
                分</span
              >
            </div>
            <RouterLink
              v-for="p in item.problems"
              :key="p.id"
              class="problem-row"
              :to="`/problems/${p.id}`"
              ><span class="problem-label">{{ p.label }}</span
              ><span class="problem-name"
                ><strong>{{ p.title }}</strong
                ><small
                  >{{ p.max_score }} 分<span v-if="p.difficulty != null">
                    · 难度 {{ p.difficulty }} / 10</span
                  ></small
                ></span
              ><span class="problem-quality"
                ><Icon name="star" :size="15" />{{ quality(p.quality)
                }}<small>{{ p.votes }} 人</small></span
              ><Icon name="arrow" :size="17" /></RouterLink
          ></template>
        </section>
        <div class="panel content-panel" v-if="tab === 'standings'">
          <Standings :contest="item" @updated="load" />
        </div>
        <div class="panel content-panel" v-if="tab === 'reviews'">
          <ReviewPanel :kind="kind" :item="item" @updated="load" />
        </div>
      </div>
      <aside class="detail-side">
        <section class="panel quality-card">
          <div class="section-kicker">社区质量评分</div>
          <div class="big-quality">
            {{ quality(item.quality) }}<span>/ 5</span>
          </div>
          <div class="stars-display" aria-hidden="true">
            <span
              v-for="i in 5"
              :key="i"
              :class="{
                filled: item.quality != null && i <= Math.round(item.quality),
              }"
              >★</span
            >
          </div>
          <p class="muted small-note">
            {{
              item.votes
                ? `${item.votes} 位成员的独立评价`
                : "还没有评分，等待第一份体验"
            }}
          </p>
          <div class="distribution">
            <div v-for="s in [5, 4, 3, 2, 1, 0]" :key="s">
              <span>{{ s }} 星</span>
              <div class="bar">
                <i
                  :style="{
                    width: item.votes
                      ? (count(s) / item.votes) * 100 + '%'
                      : '0%',
                  }"
                ></i>
              </div>
              <small>{{ count(s) }}</small>
            </div>
          </div>
          <div class="difficulty-summary">
            <span>体感难度</span
            ><strong>{{ item.difficulty ?? "—" }}<small> / 10</small></strong>
          </div>
          <button class="btn primary full" @click="tab = 'reviews'">
            <Icon name="edit" :size="17" />查看与撰写评价
          </button>
        </section>
        <div class="rating-explainer">
          <Icon name="message" :size="19" />
          <h3>好评价，可以很具体。</h3>
          <p>聊聊题目的设计、比赛的体验，或者一个让你印象深刻的细节。</p>
          <small>涉及解法？记得开启剧透折叠。</small>
        </div>
      </aside>
    </div></template
  >
</template>

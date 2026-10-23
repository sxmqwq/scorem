<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  api,
  auth,
  dateTime,
  useTask,
  toast,
  type Page,
  type Item,
} from "../api";
import Icon from "./Icon.vue";
import Pagination from "./Pagination.vue";
const props = defineProps<{ kind: string; item: Item }>();
const emit = defineEmits<{ updated: [] }>();
const data = ref<Page>({ items: [], total: 0, page: 1, pageSize: 20 }),
  open = ref(false),
  quality = ref<number | null>(null),
  difficulty = ref<number | null>(null),
  body = ref(""),
  spoiler = ref(false);
const loadError = ref(""),
  loading = ref(false);
const { busy, error, run } = useTask();
const isAdmin = computed(
  () => auth.user?.role === "admin" && auth.user.status === "approved",
);
const canReview = computed(
  () =>
    props.item.status === "published" &&
    (props.kind !== "contests" || Date.parse(props.item.end_at) <= Date.now()),
);
async function load(page = 1) {
  loading.value = true;
  loadError.value = "";
  try {
    data.value = await api(
      `/api/${props.kind}/${props.item.id}/reviews?page=${page}`,
    );
  } catch (e) {
    loadError.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}
function edit() {
  const own = props.item.ownReview;
  quality.value = own?.quality ?? null;
  difficulty.value = own?.difficulty ?? null;
  body.value = own?.body || "";
  spoiler.value = !!own?.spoiler;
  open.value = true;
  error.value = "";
}
async function save() {
  await run(async () => {
    if (quality.value == null) throw Error("请选择 0–5 分的质量评分");
    await api(`/api/${props.kind}/${props.item.id}/review`, {
      method: "PUT",
      json: {
        quality: quality.value,
        difficulty: difficulty.value,
        body: body.value,
        spoiler: spoiler.value,
      },
    });
    open.value = false;
    toast("评价已保存");
    emit("updated");
    await load();
  });
}
async function withdraw() {
  if (!window.confirm("撤回你的这份评价？可以之后重新评价。")) return;
  await run(async () => {
    await api(`/api/${props.kind}/${props.item.id}/review`, {
      method: "DELETE",
      json: {},
    });
    open.value = false;
    toast("评价已撤回");
    emit("updated");
    await load();
  });
}
async function moderate(item: Item) {
  const reason = item.hidden
    ? ""
    : window.prompt("请输入隐藏原因（会记录到操作日志）");
  if (reason == null) return;
  await run(async () => {
    await api(`/api/admin/reviews/${item.id}`, {
      method: "PATCH",
      json: { hidden: !item.hidden, reason },
    });
    toast(item.hidden ? "评价已恢复" : "评价已隐藏");
    emit("updated");
    await load(data.value.page);
  });
}
onMounted(() => load());
</script>
<template>
  <section>
    <div class="section-heading">
      <h2>
        社区评价 <span class="count-label">{{ item.votes }}</span>
      </h2>
      <button
        v-if="auth.user?.status === 'approved' && canReview"
        class="btn primary small"
        @click="edit"
      >
        <Icon name="edit" :size="16" />{{
          item.ownReview ? "编辑我的评价" : "写评价"
        }}
      </button>
    </div>
    <div class="info-box" v-if="!auth.user">
      你的体验也很重要。<RouterLink to="/login">登录</RouterLink
      >，审核通过后即可参与评价。
    </div>
    <div class="info-box" v-else-if="auth.user.status !== 'approved'">
      {{
        auth.user.status === "pending"
          ? "注册申请正在审核，先看看大家的评价吧。"
          : "当前账号尚未获得评分资格。"
      }}<RouterLink to="/account">查看审核状态</RouterLink>
    </div>
    <div class="info-box" v-else-if="!canReview">
      {{
        item.status === "archived"
          ? "此内容已归档，保留历史评价。"
          : "比赛结束并公开后即可评分。"
      }}
    </div>
    <form v-if="open" class="panel review-form" @submit.prevent="save">
      <div class="section-heading">
        <h3>{{ item.ownReview ? "修改评价" : "留下你的体验" }}</h3>
        <button
          type="button"
          class="icon-btn"
          aria-label="收起评价表单"
          @click="open = false"
        >
          <Icon name="close" />
        </button>
      </div>
      <fieldset>
        <legend>
          质量评分 <span class="muted">必选 · 0 分同样是有效评价</span>
        </legend>
        <div class="score-options">
          <label
            v-for="score in [0, 1, 2, 3, 4, 5]"
            :key="score"
            :class="{ selected: quality === score }"
            ><input
              v-model="quality"
              type="radio"
              :value="score"
              name="quality"
              required />{{ score }}<Icon name="star" :size="15"
          /></label>
        </div>
      </fieldset>
      <label
        >体感难度 <span class="optional">选填，与质量分开统计</span
        ><select v-model="difficulty">
          <option :value="null">暂不评价难度</option>
          <option v-for="d in 10" :key="d" :value="d">
            {{ d }} / 10 ·
            {{
              d <= 2
                ? "入门"
                : d <= 4
                  ? "基础"
                  : d <= 6
                    ? "进阶"
                    : d <= 8
                      ? "困难"
                      : "挑战"
            }}
          </option>
        </select></label
      ><label
        >短评<textarea
          v-model="body"
          rows="4"
          maxlength="2000"
          placeholder="哪些设计让你印象深刻？哪些体验可以改进？"
        ></textarea></label
      ><label class="check-label"
        ><input
          type="checkbox"
          v-model="spoiler"
        />包含解法或关键结论，默认折叠展示</label
      >
      <p v-if="item.ownReview?.hidden" class="info-box">
        此评价已被管理员隐藏，修改后仍需管理员恢复。原因：{{
          item.ownReview.hidden_reason
        }}
      </p>
      <p class="error-box" v-if="error" role="alert">{{ error }}</p>
      <div class="form-actions">
        <button
          v-if="item.ownReview"
          type="button"
          class="btn danger"
          :disabled="busy"
          @click="withdraw"
        >
          撤回评价</button
        ><button class="btn primary" :disabled="busy">
          {{ busy ? "正在保存…" : "保存评价" }}
        </button>
      </div>
    </form>
    <p v-if="error && !open" class="error-box" role="alert">{{ error }}</p>
    <div v-if="loading" class="loading-state" role="status">正在加载评价…</div>
    <div v-else-if="loadError" class="error-box" role="alert">
      {{ loadError }} <button class="text-btn" @click="load()">重试</button>
    </div>
    <div v-else-if="!data.items.length" class="empty-state compact">
      <Icon name="message" :size="28" />
      <h3>第一份体验，等你来写</h3>
      <p>分数之外，也欢迎分享具体的感受和建议。</p>
    </div>
    <article
      v-for="review in data.items"
      :key="review.id"
      class="review-item"
      :class="{ hidden: review.hidden }"
    >
      <div class="review-top">
        <RouterLink class="review-author" :to="`/users/${review.user_id}`"
          ><span class="avatar small">{{ review.nickname.slice(0, 1) }}</span
          ><strong>{{ review.nickname }}</strong
          ><span class="muted">@{{ review.username }}</span></RouterLink
        ><span class="review-score"
          >{{ review.quality }}<Icon name="star" :size="15"
        /></span>
      </div>
      <div v-if="review.hidden" class="info-box">
        已隐藏：{{ review.hidden_reason }}
      </div>
      <details v-if="review.spoiler && review.body" class="spoiler">
        <summary>包含剧透 · 点击查看短评</summary>
        <p class="review-body">{{ review.body }}</p>
      </details>
      <p v-else-if="review.body" class="review-body">{{ review.body }}</p>
      <div class="review-bottom">
        <span
          >{{ dateTime(review.updated_at)
          }}<span v-if="review.difficulty">
            · 难度 {{ review.difficulty }} / 10</span
          ></span
        ><button v-if="isAdmin" class="text-btn" @click="moderate(review)">
          {{ review.hidden ? "恢复显示" : "隐藏评价" }}
        </button>
      </div>
    </article>
    <Pagination v-bind="data" @change="load" />
    <button
      v-if="!open && item.ownReview && !canReview"
      class="btn small danger"
      :disabled="busy"
      @click="withdraw"
    >
      撤回我的评价
    </button>
  </section>
</template>

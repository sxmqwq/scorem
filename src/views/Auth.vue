<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api, setSession, useTask, toast } from "../api";
import { deriveProof } from "../password.mjs";
import Icon from "../components/Icon.vue";
const route = useRoute(),
  router = useRouter(),
  register = computed(() => route.path === "/register"),
  setup = computed(() => route.path === "/setup");
const username = ref(""),
  nickname = ref(""),
  password = ref(""),
  confirm = ref(""),
  application = ref(""),
  token = ref("");
const { busy, error, run } = useTask();
async function submit() {
  await run(async () => {
    if (
      (register.value || setup.value) &&
      (password.value.length < 12 || password.value.length > 128)
    )
      throw Error("密码需为 12–128 个字符，建议使用较长且独有的口令。");
    if ((register.value || setup.value) && password.value !== confirm.value)
      throw Error("两次输入的密码不一致");
    const name = username.value.trim().toLowerCase(),
      challenge = await api(
        "/api/auth/challenge?username=" + encodeURIComponent(name),
      );
    const proof = await deriveProof(password.value, challenge);
    const result = await api(
      "/api/auth/" +
        (setup.value ? "bootstrap" : register.value ? "register" : "login"),
      {
        method: "POST",
        json: {
          username: name,
          nickname: nickname.value,
          proof,
          application: application.value,
          token: token.value,
        },
      },
    );
    password.value = "";
    confirm.value = "";
    token.value = "";
    setSession(result.user, result.token);
    toast(
      setup.value
        ? "管理员已创建"
        : register.value
          ? "申请已提交，等待管理员审核"
          : "欢迎回来",
    );
    router.push(
      setup.value
        ? "/admin"
        : register.value || result.user.status !== "approved"
          ? "/account"
          : "/contests",
    );
  });
}
</script>
<template>
  <div class="auth-layout">
    <section class="auth-story">
      <div class="eyebrow"><span></span>WELCOME TO SCOREM</div>
      <h1>你的体验，<br />让下一场选择<br /><em>更有依据。</em></h1>
      <p>比赛不止有名次，题目不止有答案。<br />在这里，留下你的真实感受。</p>
      <div class="auth-principles">
        <span><Icon name="check" />不同 OJ，同一个交流空间</span
        ><span><Icon name="check" />质量与难度，分别表达</span
        ><span><Icon name="check" />审核后参与，每人一份评价</span>
      </div>
    </section>
    <section class="panel auth-card">
      <span class="section-kicker">{{
        setup ? "首次配置" : register ? "成为社区的一员" : "好久不见"
      }}</span>
      <h2>
        {{ setup ? "创建首位管理员" : register ? "注册 scorem" : "欢迎回来" }}
      </h2>
      <p class="muted">
        {{
          setup
            ? "使用部署时设置的初始化口令。"
            : register
              ? "提交申请，审核通过后即可评分。"
              : "登录，继续你的比赛记录。"
        }}
      </p>
      <form @submit.prevent="submit">
        <label
          >用户名<input
            v-model="username"
            required
            pattern="[a-zA-Z0-9_]{3,32}"
            maxlength="32"
            autocomplete="username"
            placeholder="3–32 位字母、数字或下划线" /></label
        ><label v-if="register || setup"
          >昵称<input
            v-model="nickname"
            required
            maxlength="40"
            autocomplete="nickname"
            placeholder="大家如何称呼你" /></label
        ><label
          >密码<input
            v-model="password"
            type="password"
            required
            :minlength="register || setup ? 12 : 1"
            maxlength="128"
            :autocomplete="
              register || setup ? 'new-password' : 'current-password'
            "
            :placeholder="
              register || setup ? '至少 12 个字符' : '请输入密码'
            " /></label
        ><label v-if="register || setup"
          >确认密码<input
            v-model="confirm"
            type="password"
            required
            minlength="12"
            maxlength="128"
            autocomplete="new-password"
            placeholder="再次输入密码" /></label
        ><label v-if="register"
          >申请说明 <span class="optional">选填</span
          ><textarea
            v-model="application"
            maxlength="500"
            rows="3"
            placeholder="简单介绍你的竞赛经历或加入原因"
          ></textarea></label
        ><label v-if="setup"
          >初始化口令<input
            v-model="token"
            type="password"
            required
            autocomplete="off"
            placeholder="部署时的 BOOTSTRAP_TOKEN"
        /></label>
        <p v-if="error" class="error-box" role="alert">{{ error }}</p>
        <button class="btn primary full" :disabled="busy">
          {{
            busy
              ? "正在处理…"
              : setup
                ? "创建管理员"
                : register
                  ? "提交注册申请"
                  : "登录"
          }}<Icon name="arrow" :size="17" />
        </button>
      </form>
      <p class="auth-switch" v-if="!setup">
        {{ register ? "已有账号？" : "还没有账号？"
        }}<RouterLink :to="register ? '/login' : '/register'">{{
          register ? "前往登录" : "申请加入"
        }}</RouterLink>
      </p>
    </section>
  </div>
</template>

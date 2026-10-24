# scorem

独立的算法竞赛评价站前端。支持任意 OJ 的比赛手动录入，注册用户经管理员审核后参与评价。

前端：Vue 3 + TypeScript + Vite。部署目标：GitHub Pages。后端独立运行在 Cloudflare Workers + D1。

## 已实现

- 比赛广场、独立题库、搜索、排序、分页，访客可浏览公开内容。
- 比赛 / 题目质量评分 0–5 分，体感难度 1–10，短评、剧透折叠、编辑与撤回。
- 注册申请、审核状态、个人资料、修改密码、个人评分记录。
- 管理员通过 / 拒绝 / 停用账号，管理角色，隐藏 / 恢复评价，查看操作日志。
- 手动编辑比赛与 Markdown 题面、JSON 导入比赛、复用已有题目、PDF 附件。
- CSV 成绩校验、预览和整场替换；显式关联用户，不按昵称自动合并。
- 成绩榜、竞技 Rating 排行、个人 Rating 历史；可暂停、继续和取消重算。

## 本地开发

需要 Node.js 24 和 npm。先启动后端，再启动此项目：

```bash
npm ci
cp .env.example .env.local
npm run dev
```

打开 `http://localhost:4173/scorem/`。`.env.local`：

```dotenv
VITE_API_BASE_URL=http://localhost:8787
VITE_BASE_PATH=/scorem/
```

后端的 `ALLOWED_ORIGINS` 应包含 `http://localhost:4173`。不同端口、`localhost` 与 `127.0.0.1` 是不同来源。

## GitHub Pages 部署

1. 先按照后端仓库 README 部署 Worker，确认 `/api/health` 返回 `schema: "ready"`。
2. 在此仓库 **Settings → Secrets and variables → Actions → Variables** 添加仓库变量：

   | 变量                | 值                                                                                          |
   | ------------------- | ------------------------------------------------------------------------------------------- |
   | `VITE_API_BASE_URL` | 你自己的 Worker 根地址，例如 `https://your-api.your-subdomain.workers.dev`，不要追加 `/api` |

3. **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
4. **Actions → Deploy GitHub Pages → Run workflow**。以后推送 `main` 会自动更新。
5. 项目名为 `scorem` 时，访问 `https://<GitHub用户名>.github.io/scorem/`。

仓库名由工作流自动用于 `VITE_BASE_PATH`。使用 Hash 路由，详情页形如 `/scorem/#/contests/<id>`，刷新也能打开。

**没有设置 `VITE_API_BASE_URL` 时部署任务会跳过。代码没有内置任何人的生产 API 地址，Fork 后必须配置自己的后端。** API 地址是公开配置，不是密码。访问权限由后端审核、会话和角色控制。

若改成自定义域名的根目录，将 Pages 工作流的 `VITE_BASE_PATH` 改为 `/`，并同步修改后端 `ALLOWED_ORIGINS`。

## 创建第一个管理员

后端迁移和 Secrets 配好后，访问站点的 `#/setup` 页面：

1. 输入管理员用户名、昵称和至少 12 个字符的密码。
2. 输入 Cloudflare 中设置的 `BOOTSTRAP_TOKEN`。
3. 创建成功后，去 Cloudflare 删除 `BOOTSTRAP_TOKEN`。后端数据库也会永久记录初始化已完成，阻止再次创建。

之后普通用户通过 `#/register` 申请，管理员在「管理工作台 → 成员审核」处理。

## 登录状态

登录凭据按后端返回的过期时间保存，最长 7 天。刷新页面、切换页面或新开标签页会恢复登录；同一后端的多个标签页会同步登录和退出。旧版标签页中的登录会自动迁移。

浏览器持久存储只保留会话 token 和过期时间，不保存密码、登录 proof 或个人资料；若持久存储不可用则退回标签页存储，再不可用时保留当前页面的内存会话。退出登录会清除保存的凭据；改密码、账号停用和服务端会话过期仍会使登录失效。

网络断开、服务错误和请求限流不会清除登录。恢复账号信息失败时可点击「重试连接」。旧请求的迟到响应不会覆盖新登录或其他标签页切换后的账号。

## 内容与成绩导入

### 比赛 JSON

「添加比赛 → 下载 JSON 模板」可下载标准格式。导入只填充表单，核对并保存后才会写入数据库。默认导入为草稿。

```json
{
  "title": "周末训练赛",
  "source": "任意 OJ",
  "source_url": "https://example.com/contest",
  "description": "比赛说明，支持 Markdown。",
  "start_at": "2026-01-01T01:00:00Z",
  "end_at": "2026-01-01T05:00:00Z",
  "status": "draft",
  "rated": false,
  "problems": [
    {
      "label": "A",
      "title": "示例题目",
      "max_score": 100,
      "statement": "# 题目描述",
      "source": "任意 OJ",
      "source_url": ""
    }
  ]
}
```

复用题目时，用 `{"id":"已有题目ID","label":"A","max_score":100}`。题目是独立记录，复用共享评价。发布比赛会公开关联的草稿题目，请在适当时间发布。

### 成绩 CSV

在比赛详情的「成绩榜 → 管理成绩导入」下载对应题号的模板：

```csv
external_key,display_name,username,A,B
student-001,选手甲,alice,100,80
student-002,选手乙,,60,0
```

- `external_key`：本场唯一、稳定的选手编号；不是本站用户 ID。
- `display_name`：显示姓名，可重复，不参与账号关联。
- `username`：选填；填写时必须精确匹配本站已通过审核的用户名。留空只建立成绩记录。
- 题号列必须与比赛一致，空分数视为 0，最多两位小数，不能超出满分。
- 每场最多 500 人、30 题。先校验和预览，再确认替换。校验失败不会改变旧成绩。
- 也可在成绩表中逐个关联账号。替换 CSV 会以新文件中的账号关联为准。
- 已有成绩时不能改变题目、题号、顺序或满分；需先清空成绩，再修改并重新导入。

## Rating 规则

竞技 Rating 与质量评分完全独立，初始值为 1500。只有勾选「启用竞技 Rating」、已结束且公开的比赛参与结算。只统计总分大于 0 且明确关联账号的选手，计分组同分使用平均名次。

算法采用预期名次与实际名次的几何平均、二分反推表现分、减半差值和整体均值修正。它是本站的类 CF 算法，不等同于 Codeforces 官方结算。每次重算从初始分按结束时间重放完整历史，保证修改旧成绩、关联账号或取消 Rated 后结果一致。分批任务最后统一发布，可在管理台暂停或继续。

## 验证

```bash
npm test
npm run build
```

测试验证登录派生协议与 Node PBKDF2 的一致性、CSV 转义和公式注入防护。后端仓库另有在实际 workerd / D1 本地运行时执行的集成测试。

会话回归测试直接执行编译后的客户端模块，覆盖迟到的未登录响应、账号切换、并发恢复、跨标签页持久登录、过期与存储失败，以及网络故障时保留登录。

## 范围

本版本不含 OJ 自动抓取、代码评测、AI 原题检索或邮件服务。PDF 单文件 1 MiB，每项最多 5 个；较大题面请提供外部链接。密码忘记时需联系管理员维护，暂不提供邮件找回密码。

功能参考 [liankao-ng](https://github.com/tzl-index545/liankao-ng)，前后端针对独立部署重新实现。

# 途灵 · AI 旅游助手

[![Expo SDK](https://img.shields.io/badge/Expo-SDK%2054-000020?logo=expo)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React%20Native-0.81-61DAFB?logo=react)](https://reactnative.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-24+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![License](https://img.shields.io/badge/license-Private-lightgrey)](#许可证)

> 用自然语言规划行程，结合高德 POI、和风天气与评价闭环，把「想去哪玩」变成可执行、可编辑、可分享的旅行计划。

**途灵**是一个练手向的全栈 Monorepo：Expo（React Native）手机端 + 自建 Node/Express 后端 + Claude Agent。密钥与外部 API 全部走服务端，App 只与自己的后端通信。

---

## 目录

- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [架构概览](#架构概览)
- [项目结构](#项目结构)
- [环境要求](#环境要求)
- [快速开始](#快速开始)
- [环境变量](#环境变量)
- [常用脚本](#常用脚本)
- [API 一览](#api-一览)
- [打包与发布](#打包与发布)
- [真机调试说明](#真机调试说明)
- [设计原则与安全](#设计原则与安全)
- [进一步阅读](#进一步阅读)
- [路线图](#路线图)
- [贡献](#贡献)
- [许可证](#许可证)
- [致谢](#致谢)

---

## 功能特性

### AI 对话与行程规划

- **自然语言闲聊**：SSE 流式回复（`?stream=1`），支持打字机效果
- **结构化行程生成**：目的地、天数、预算、偏好、同行人、节奏、出行月份等
- **拍照提问**：上传 JPEG/PNG，结合图像内容回答旅行相关问题
- **语音输入**：Web Speech / 系统键盘听写辅助录入
- **快速短途**：底部中间「＋」一键打开短途规划弹窗

### 行程体验

- **按天行程卡片**：景点 / 餐饮 / 住宿 / 交通分类展示
- **高德 POI 回填**：坐标、评分、地址、营业时间、封面图
- **地图与通勤**：行程地图（WebView JS API）+ 两点通勤耗时提示
- **天气条**：和风未来天气预报，辅助出行决策
- **本地编辑**：拖拽排序、增删改点位、时间调整
- **分享与导出**：文本分享、行程长图、JSON 备份导出
- **离线可读**：断网仍可浏览已保存行程；评价入队，联网后自动补发

### 评价闭环与社区

- **单点 / 整程评价**：赞踩 + 标签 + 短评，详情页回显高亮
- **行程上云**：本地 AsyncStorage 为主，保存时尽力上传以挂载评价
- **个人偏好卡片**：汇总历史赞/踩标签（「我的」页）
- **社区 Feed**：分享行程 / 旅拍 / 评价，点赞、收藏、评论

### 体验与无障碍

- **长辈模式**：更大字号与更易点的控件
- **深浅色主题**、触觉反馈、隐私同意弹窗
- **数据质量提示**：POI 未命中、日程过空等透明警告

---

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 客户端 | Expo 54 · React Native 0.81 · Expo Router · TypeScript | 文件式路由，iOS / Android |
| 后端 | Node.js 24 · Express 5 · Zod · JWT | ESM + `tsx` 热重载 |
| AI | Anthropic Claude SDK | 支持课程网关 Bearer 或官方 API Key |
| 地图 / 天气 | 高德 Web API · 和风天气 | POI、距离、预报 |
| 存储 | AsyncStorage（端侧）· SQLite `node:sqlite`（服务端） | 行程本地优先，评价落库 |
| 工程 | pnpm workspace Monorepo | `apps/*` + `packages/shared` |
| 构建 | EAS Build | Android APK preview / production |

---

## 架构概览

```
┌────────────────────┐         HTTPS / LAN HTTP          ┌────────────────────┐
│  途灵 App (Expo)    │ ────────────────────────────────► │  Node 后端          │
│  聊天 / 行程 / 社区  │ ◄──────────────────────────────── │  Express + Claude   │
│  AsyncStorage 缓存  │         JWT 设备登录               │  SQLite 行程/评价   │
└────────────────────┘                                   └─────────┬──────────┘
                                                                   │
                     ┌─────────────────┬───────────────────────────┼────────────┐
                     ▼                 ▼                           ▼            ▼
               Claude API         高德 POI/距离              和风天气      （可选扩展）
```

**职责划分**

| 角色 | 做什么 | 不做什么 |
|------|--------|----------|
| App | UI、本地缓存、鉴权 token、展示与编辑 | 不持有 Claude / 服务端密钥 |
| 后端 | Prompt、工具调用、POI/天气、限流、落库 | 不负责复杂原生 UI |
| 共享包 `@travel/shared` | 请求/响应与行程类型的唯一真相源 | — |

一句话：**App 只跟自己的后端说话，后端才跟外面的世界说话。**

---

## 项目结构

```
ai-travel-assistant/
├── apps/
│   ├── mobile/                 # Expo App（途灵）
│   │   ├── app/                # Expo Router 页面
│   │   │   ├── (tabs)/         # 规划 / 行程 / 社区 / 我的
│   │   │   ├── trip/           # 详情、预览、编辑
│   │   │   ├── community/      # 社区详情
│   │   │   └── profile/        # 帮助、证件、行李等
│   │   ├── src/                # 组件、API、存储、主题
│   │   ├── assets/             # 图标与启动图
│   │   ├── eas.json            # EAS 构建配置
│   │   └── .env.example
│   └── server/                 # Express 后端
│       ├── src/
│       │   ├── routes/         # auth / chat / trip / reviews / …
│       │   ├── services/       # Claude、高德、天气、距离
│       │   ├── store/          # SQLite 仓储
│       │   ├── middleware/     # JWT、限流
│       │   ├── db.ts
│       │   └── index.ts
│       └── .env.example
├── packages/
│   └── shared/                 # 前后端共享 TypeScript 类型
├── docs/                       # 技术方案、UX、踩坑笔记
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

---

## 环境要求

| 依赖 | 版本建议 |
|------|----------|
| Node.js | **24+**（使用内置 `node:sqlite`） |
| pnpm | 9+ / 11+（仓库已用 pnpm workspace） |
| 手机调试 | Expo Go，或 EAS / `expo run:android` 开发构建 |
| 可选 | 高德开发者账号、和风天气 Key、EAS 账号（打 APK） |

Windows 用户请使用较新的 Node 24，避免为原生 SQLite 绑定安装 Visual Studio 构建工具。

---

## 快速开始

### 1. 克隆并安装

```bash
git clone https://github.com/<your-username>/ai-travel-assistant.git
cd ai-travel-assistant
pnpm install
```

> 根目录 `.npmrc` 已配置国内镜像与 `node-linker=hoisted`（Expo / Metro 所需）。

### 2. 配置后端

```bash
cp apps/server/.env.example apps/server/.env
```

编辑 `apps/server/.env`，至少配置其一：

- **方式 A（推荐，国内可用）**：`CLAUDE_BASE_URL` + `CLAUDE_AUTH_TOKEN` + `CLAUDE_MODEL`
- **方式 B**：官方 `CLAUDE_API_KEY`（直连 `api.anthropic.com`，通常需代理）

并设置 `JWT_SECRET`（随机长字符串）。完整行程体验还需填写高德 / 和风 Key（见下方[环境变量](#环境变量)）。

### 3. 配置手机 App

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

```bash
# 真机必须用电脑局域网 IP，不能用 localhost
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:3000

# 行程地图 WebView（高德「Web端 JS API」Key，与后端 Web Key 不同）
EXPO_PUBLIC_AMAP_JS_KEY=
EXPO_PUBLIC_AMAP_JS_SECURITY=
```

### 4. 启动

开两个终端：

```bash
# 终端 1：后端（监听 0.0.0.0:3000，供真机访问）
pnpm dev:server

# 终端 2：Expo
pnpm dev:mobile
```

- 健康检查：浏览器打开 `http://localhost:3000/health`，应返回 `{ ok: true, ... }`
- 手机：Expo Go 扫码，或手动输入 `exp://<电脑IP>:8081`
- 电脑与手机需在同一局域网；若连不上，见 [真机调试说明](#真机调试说明)

---

## 环境变量

### 后端 `apps/server/.env`

| 变量 | 必填 | 说明 |
|------|------|------|
| `CLAUDE_AUTH_TOKEN` 或 `CLAUDE_API_KEY` | 是 | 网关 Bearer 或官方 Key，二选一 |
| `CLAUDE_BASE_URL` | 网关时 | 如课程网关地址 |
| `CLAUDE_MODEL` | 建议 | 如 `claude-sonnet-4-6` |
| `JWT_SECRET` | 是 | 签发设备登录 JWT |
| `PORT` | 否 | 默认 `3000` |
| `AMAP_WEB_KEY` | 行程增强 | 高德 Web 服务 Key（POI / 距离） |
| `QWEATHER_KEY` | 天气 | 和风 Key |
| `QWEATHER_API_HOST` / `QWEATHER_GEO_HOST` | 天气 | 和风 API / Geo 主机 |
| `RATE_LIMIT_CHAT_PER_MIN` | 否 | 聊天限流，默认 20 |
| `RATE_LIMIT_TRIP_PER_MIN` | 否 | 行程生成限流，默认 5 |

### 客户端 `apps/mobile/.env`

| 变量 | 必填 | 说明 |
|------|------|------|
| `EXPO_PUBLIC_API_BASE_URL` | 真机调试时 | 后端根地址，如 `http://192.168.1.100:3000` |
| `EXPO_PUBLIC_AMAP_JS_KEY` | 地图 | 高德 Web 端（JS API）Key |
| `EXPO_PUBLIC_AMAP_JS_SECURITY` | 地图 | 对应 securityJsCode |

> 所有 `EXPO_PUBLIC_*` 会打进客户端包，**只能放非密钥配置**。Claude / 服务端 Key 禁止写入 App。

---

## 常用脚本

| 命令 | 说明 |
|------|------|
| `pnpm install` | 安装全部 workspace 依赖 |
| `pnpm dev:server` | 启动后端（`tsx watch`） |
| `pnpm dev:mobile` | 启动 Expo 开发服务器 |
| `pnpm --filter @travel/server build` | 编译后端 TypeScript |
| `pnpm --filter @travel/mobile android` | 本地 Android 开发构建 |
| `pnpm --filter @travel/mobile ios` | 本地 iOS 开发构建（需 macOS） |

---

## API 一览

基础路径默认：`http://<host>:3000`。除注明外，业务接口需 `Authorization: Bearer <token>`（先调设备登录）。

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/health` | 健康检查（无需登录） |
| `POST` | `/api/auth/device` | 设备 ID 换 JWT |
| `GET` / `PATCH` | `/api/auth/profile` | 昵称与头像 |
| `POST` | `/api/chat` | 闲聊；`?stream=1` 为 SSE |
| `POST` | `/api/trip/generate` | 生成结构化行程 |
| `GET` / `POST` / `PUT` | `/api/trips` | 行程上云列表 / 创建 / 更新 |
| `POST` / `GET` | `/api/reviews` | 提交评价 / 回显 |
| `GET` | `/api/reviews/preferences` | 个人偏好汇总 |
| `GET` | `/api/pois/reputation` | POI 社区口碑 |
| `GET` | `/api/weather` | 天气预报 |
| `GET` | `/api/distance` | 两点通勤 |
| `POST` | `/api/chat/feedback` | 聊天消息级赞踩 |
| `GET` / `POST` … | `/api/community/posts` | 社区帖子、点赞、收藏、评论 |

请求与响应类型统一在 [`packages/shared/src/index.ts`](packages/shared/src/index.ts) 定义。

---

## 打包与发布

使用 [EAS Build](https://docs.expo.dev/build/introduction/) 打内部预览包（Android APK）：

```bash
cd apps/mobile
npx eas login
npx eas build --profile preview --platform android
```

配置见 [`apps/mobile/eas.json`](apps/mobile/eas.json)：

- `development`：开发客户端
- `preview`：内部发行 APK
- `production`：正式包（可配合 `eas submit`）

生产环境请将 `EXPO_PUBLIC_API_BASE_URL` 指向 **HTTPS** 域名，并收紧后端 CORS。

---

## 真机调试说明

1. 后端必须监听 `0.0.0.0`（本仓库已如此配置），不能只绑 `localhost`
2. `EXPO_PUBLIC_API_BASE_URL` 使用电脑的局域网 IP，例如 `http://192.168.1.8:3000`
3. 电脑防火墙放行 3000（API）与 8081（Metro）端口
4. 手机与电脑同一 Wi‑Fi；部分公司/校园网隔离客户端互通，需换热点
5. 更换网络后 IP 会变，需同步改 `.env` 并重启 Expo（详见 [`docs/Expo真机连接IP变更问题.md`](docs/Expo真机连接IP变更问题.md)）

---

## 设计原则与安全

- **密钥隔离**：Claude、高德服务端 Key、JWT Secret 仅存后端环境变量
- **设备匿名登录**：`deviceId` → JWT，降低练手阶段接入成本
- **输入校验**：Zod 校验请求体；聊天 / 行程接口带每分钟限流
- **崩溃安全保存**：行程先写本地，再尽力上传；上传失败不影响本地可读
- **评价归属**：评价前校验行程归属，防止越权
- **隐私合规**：首次启动隐私同意；本地数据可导出备份

---

## 进一步阅读

| 文档 | 内容 |
|------|------|
| [`docs/技术方案.md`](docs/技术方案.md) | 架构选型、API 契约、AI 工具调用、评价闭环设计 |
| [`docs/UX优化大纲.md`](docs/UX优化大纲.md) | 交互与体验优化清单 |
| [`docs/重要提示词汇总.md`](docs/重要提示词汇总.md) | 产品文案与提示语 |
| [`docs/Expo真机连接IP变更问题.md`](docs/Expo真机连接IP变更问题.md) | 局域网调试踩坑 |
| [`阶段3.5-关键要点.md`](阶段3.5-关键要点.md) | SQLite、行程上云、评价落库要点 |

---

## 路线图

- [x] 设备登录 + AI 闲聊（含 SSE）
- [x] 结构化行程生成 + 高德 / 天气增强
- [x] 本地行程管理、编辑、分享、离线阅读
- [x] 评价闭环落库与偏好汇总
- [x] 轻量社区 Feed
- [ ] 偏好 / 口碑更深度注入 Prompt（RAG / 个性化增强）
- [ ] 生产级 Postgres 部署与 HTTPS
- [ ] 更完整的多语言与无障碍

---

## 贡献

本仓库目前以个人练手与学习为主。若你 fork 后改进：

1. Fork 本仓库并创建功能分支
2. 保持 `@travel/shared` 为类型唯一来源，避免前后端字段漂移
3. 不要提交 `.env`、密钥、本地 `*.db` 或 `node_modules`
4. 提交说明写清「为什么改」，便于回顾

Issue / PR 欢迎围绕：真机兼容、行程质量、评价反哺、文档与类型安全。

---

## 许可证

当前仓库标记为 **Private / 未声明开源许可证**。若你公开 fork，请自行补充 `LICENSE` 并理清第三方 SDK（高德、和风、Anthropic、Expo）的使用条款。

---

## 致谢

- [Anthropic Claude](https://www.anthropic.com/) — 行程推理与对话
- [高德开放平台](https://lbs.amap.com/) — POI、距离与地图
- [和风天气](https://dev.qweather.com/) — 天气预报
- [Expo](https://expo.dev/) — 跨端 App 脚手架

---

**途灵** —— 让每一次出发，都先有一张靠谱的行程表。

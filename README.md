# AI 旅游助手

Expo (React Native) + Node 后端 + Claude 的练手旅游助手 Monorepo。

## 快速启动

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置后端

```bash
cp apps/server/.env.example apps/server/.env
# 填入 CLAUDE_AUTH_TOKEN 或 CLAUDE_API_KEY，以及高德/和风 Key
```

### 3. 配置手机 App

```bash
cp apps/mobile/.env.example apps/mobile/.env
# EXPO_PUBLIC_API_BASE_URL 填电脑局域网 IP，如 http://192.168.x.x:3000
```

### 4. 启动

```bash
# 终端 1：后端
pnpm dev:server

# 终端 2：Expo（真机用 LAN）
pnpm dev:mobile
```

手机 Expo Go 扫码或手动输入 `exp://<电脑IP>:8081`。

## 打包（EAS）

```bash
cd apps/mobile
npx eas login
npx eas build --profile preview --platform android
```

## 项目结构

- `apps/mobile` — Expo App
- `apps/server` — Express + Claude Agent 后端
- `packages/shared` — 前后端共享类型

## 主要能力

- 闲聊（SSE 流式）与结构化行程生成
- 高德 POI / 和风天气 / 地图 / 外链跳转
- 本地保存 + 评价闭环 + 离线阅读
- 行程编辑、分享、JSON 导出

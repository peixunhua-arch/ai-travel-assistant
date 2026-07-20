# Expo 真机连接：IP 变了连不上怎么办

> 原理 + 排查 + 解决，一篇讲透。

---

## 一、问题描述

Expo Go 开发时，手机突然连不上电脑的 Metro bundler。现象是：
- Expo Go 一直转圈 / 报「无法连接」
- 之前明明能连上，什么都没改就不行了

---

## 二、根本原因：局域网 IP 变了

### 2.1 Expo Go 怎么连电脑的

Expo Go **不是通过 USB 线**连电脑的（那是 Android 的 `adb reverse` 方式）。它的默认方式是 **WiFi 局域网通信**：

```
手机（Expo Go）  ──── WiFi 路由器 ────  电脑（Metro bundler + 后端）
  10.96.x.x                                      10.96.207.41:8081
```

手机需要知道电脑在局域网里的 **IP 地址**，才能通过 HTTP 访问电脑上的两个服务：

| 服务 | 端口 | 作用 |
|------|------|------|
| Metro bundler | 8081 | 打包 JS bundle，Expo Go 下载并运行 |
| Node 后端 | 3000 | 提供 API（登录、生成行程、评价等） |

### 2.2 为什么 IP 会变

家庭/公共 WiFi 用的是 **DHCP 动态分配 IP**。路由器有一个 IP 池（比如 `10.96.207.1` ~ `10.96.207.254`），设备连上时**随机分一个**，而且有 **租约期**（通常 2~24 小时）。

IP 变化的常见触发条件：

| 场景 | 为什么变 |
|------|---------|
| 换了 WiFi（从家里换到咖啡厅） | 不同 WiFi 是完全不同的网段，IP 必变 |
| 同一 WiFi 断开重连 | 租约过期后重连，路由器可能分个新 IP |
| 电脑休眠后唤醒 | 网卡重连，可能拿到新 IP |
| 路由器重启 | 所有设备重新分配 IP |
| 手机和电脑连了不同 WiFi | 不在同一局域网，根本无法通信 |

本项目实际发生的：电脑 IP 从 `172.30.60.49`（旧 WiFi）变成了 `10.96.207.41`（新 WiFi），但 `.env` 文件里还写着旧 IP。

### 2.3 IP 变了之后，哪里会出错

Expo 真机开发有两个地方需要写电脑的 IP，IP 一变全部失联：

```
① 手机连 Metro（打包 JS）
   手机 Expo Go → exp://旧IP:8081  ✗ 旧IP不指向电脑了

② App 连后端（API 请求）
   .env: EXPO_PUBLIC_API_BASE_URL=http://旧IP:3000  ✗ 同上
```

两个都要改成新 IP 才能恢复。

---

## 三、排查步骤（遇到连不上时照这个走）

### 第 1 步：确认电脑和手机在同一个 WiFi

这是最常被忽略的一步。**两个设备必须连同一个 WiFi 名称（SSID）**。

- 如果电脑连了网线、手机连了 WiFi → 大概率不在同一网段，连不上
- 如果公司 WiFi 有访客网络隔离 → 即使同名也可能隔离

### 第 2 步：查电脑当前 IP

**用 Node 查（推荐，编码不乱）**：

```bash
node -e "const n=require('os').networkInterfaces();for(const k in n){for(const i of n[k]){if(i.family==='IPv4'&&!i.internal)console.log(k+': '+i.address)}}"
```

输出类似：
```
WLAN: 10.96.207.41
```

> ⚠️ 别用 `ipconfig`——Windows 的 ipconfig 输出是 UTF-16 编码，在 bash 管道里会被当成 binary 文件，grep 匹配不到。

### 第 3 步：确认两个服务在跑

```bash
# 查端口占用
netstat -ano | grep LISTENING | grep -E ":8081|:3000"

# 或者直接打健康检查
curl -s http://localhost:3000/health       # 后端
curl -s http://localhost:8081/status       # Metro → 应返回 packager-status:running
```

如果端口空闲 → 服务没启动，需要起服务：
```bash
cd apps/server && pnpm dev          # 起后端
cd apps/mobile && npx expo start    # 起 Metro
```

### 第 4 步：对比 IP 是否变了

拿第 2 步查到的 IP，跟以下两处对比：
- **手机 Expo Go 里输入的地址**：`exp://<IP>:8081`
- **`apps/mobile/.env` 里的 `EXPO_PUBLIC_API_BASE_URL`**：`http://<IP>:3000`

如果不一致 → 就是 IP 变了，走下面的解决步骤。

---

## 四、解决步骤

### 4.1 改 `.env` 里的后端地址

打开 `apps/mobile/.env`，把 IP 改成新的：

```env
# 改成你刚查到的 IP
EXPO_PUBLIC_API_BASE_URL=http://10.96.207.41:3000
```

### 4.2 重启 Metro（`.env` 变更必须重启）

`.env` 是在 Metro 启动时读取的，改完不重启不会生效：

```bash
# 杀掉旧 Metro（先查 PID）
netstat -ano | grep :8081 | grep LISTENING
# 输出: TCP 0.0.0.0:8081 ... LISTENING 7140  ← PID 是 7140
taskkill //PID 7140 //F

# 重启（加 --clear 清缓存，确保新配置生效）
cd apps/mobile && npx expo start --clear
```

### 4.3 手机连新地址

在 Expo Go 里输入新地址：

```
exp://10.96.207.41:8081
```

> 如果是扫码连接，注意二维码里的地址也是基于电脑 IP 生成的，重启 Metro 后会自动用新 IP。

---

## 五、原理深入：为什么有这么多环节

### 5.1 localhost vs 局域网 IP

```
localhost / 127.0.0.1  →  指设备自己
192.168.x.x / 10.x.x.x →  局域网内其他设备的地址
```

电脑上的后端监听 `0.0.0.0:3000`（所有网卡），在电脑自己用 `localhost:3000` 能访问。但**手机是另一台设备**，它用 `localhost` 指的是手机自己，根本访问不到电脑的后端。所以必须用电脑的局域网 IP。

### 5.2 Metro bundler 的角色

```
手机 Expo Go
    │
    │ 1. 请求 http://电脑IP:8081/index.bundle  （下载 JS bundle）
    │
    ▼
Metro bundler（电脑）
    │
    │ 2. 读取 .env，把 EXPO_PUBLIC_API_BASE_URL 注入 JS bundle
    │
    ▼
JS bundle 里写死了后端地址
    │
    │ 3. App 运行后，fetch('http://电脑IP:3000/api/...')
    │
    ▼
Node 后端（电脑）
```

**关键点**：`.env` 里的 `EXPO_PUBLIC_API_BASE_URL` 是在 Metro **打包时**注入到 JS 代码里的，不是运行时动态读的。所以改了 `.env` 必须重启 Metro 重新打包，否则 App 里的后端地址还是旧的。

### 5.3 DHCP 租约机制

DHCP（Dynamic Host Configuration Protocol）是路由器分配 IP 的协议：

1. 设备连上 WiFi → 向路由器发 DHCP Discover（广播「谁给我 IP？」）
2. 路由器回 DHCP Offer（「我给你 10.96.207.41，租约 2 小时」）
3. 设备回 DHCP Request（「好的，我接受」）
4. 路由器回 DHCP ACK（「确认，2 小时后续约或换 IP」）

租约期内续约 → IP 不变。租约过期后重新分配 → 可能拿到新 IP。这就是为什么「昨天好好的今天就不行」。

### 5.4 为什么不固定 IP

在家庭路由器里，可以给电脑的 MAC 地址绑定固定 IP（DHCP 静态分配）。但在公共 WiFi / 公司 WiFi / 咖啡店，你没有路由器管理权限，只能接受动态 IP。

对于练手项目，改 `.env` + 重启 Metro 就几秒钟的事，不值得折腾固定 IP。如果要长期开发，可以在路由器后台绑定 MAC 地址。

---

## 六、一页速查卡

```
连不上？查三件事：

1. 同一 WiFi？  → 手机和电脑连同一个 SSID
2. 服务在跑？   → curl localhost:3000/health + curl localhost:8081/status
3. IP 变了？    → node -e "查IP" → 对比 .env 和 Expo Go 里的地址

IP 变了怎么办？

1. 改 apps/mobile/.env → EXPO_PUBLIC_API_BASE_URL=http://新IP:3000
2. 杀旧 Metro → taskkill //PID <PID> //F
3. 重启 Metro → npx expo start --clear
4. 手机连 → exp://新IP:8081
```

---

## 七、本项目涉及的关键文件

| 文件 | 作用 | IP 变时要改吗 |
|------|------|:---:|
| `apps/mobile/.env` | `EXPO_PUBLIC_API_BASE_URL` 后端地址 | ✅ 改 |
| `apps/mobile/src/config.ts` | 打包默认地址（被 .env 覆盖） | 一般不用 |
| `apps/mobile/src/apiBase.ts` | 运行时可改的后端地址（「我的」页设置） | 如果之前手动改过要重设 |
| `apps/server/.env` | 后端配置（PORT 等） | ❌ 不用改 |

> 注意：`apiBase.ts` 支持在「我的」页长按版本号 → 演示服务器里手动改后端地址。如果之前设过旧 IP，也要在 App 里重新改一次。改 `.env` + 重启 Metro 是最干净的方式。

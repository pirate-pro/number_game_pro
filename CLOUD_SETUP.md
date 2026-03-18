# 数忆数（微信小游戏）云开发配置

## 需要创建的集合

1. `players`
2. `rooms`
3. `speed_records`

## 必做：上传云函数

本项目好友对战默认走云函数网关 `nm_bridge`，请在微信开发者工具中：

1. 打开 `cloudfunctions/nm_bridge`
2. 安装依赖（开发者工具会提示）
3. 右键 `nm_bridge` -> 上传并部署（云端安装依赖）

未部署时会自动尝试数据库直连，但在权限收紧场景下对战会失败。

## 开发期权限

开发联机阶段建议先设为：

- 所有用户可读可写

上线前建议改为：

- 读：按业务放开
- 写：改由云函数写入（防止恶意篡改）

## 云环境选择

代码初始化顺序：

1. 优先读取 `CLOUD_ENV_ID`（`js/services/cloud.js` 内常量）
2. 其次读取本地缓存 `cloud_env_id`
3. 最后使用 `wx.cloud.DYNAMIC_CURRENT_ENV`

如果你想手动切环境，可在控制台执行一次：

`wx.setStorageSync("cloud_env_id", "你的环境ID")`

如果你已经开通云开发但仍提示“没有权限”，请优先检查：

1. 当前项目 `appid` 是否就是开通云开发的小游戏 `appid`
2. 开发者工具右上角云环境是否选中正确环境
3. `nm_bridge` 是否已上传部署到当前环境
4. 在开发者工具控制台执行：`wx.setStorageSync("cloud_env_id", "你的环境ID")`，然后重新编译

## 推荐索引（可选，提升性能）

目前代码已做“无索引兜底”，不建索引也能跑通。  
如果后续玩家量上来，建议再加这些索引：

### `players`

- `onlineAt`（降序）
- `playerId`（唯一）

### `rooms`

- `status + difficulty + createdAt`
- `roomCode + createdAt`

### `speed_records`

- `score`（降序）
- `elapsedMs`（升序）
- `createdAt`（降序）

## 关键字段说明

### `players`

- `playerId`: 本地玩家ID
- `nickName`: 玩家昵称
- `roomCode`: 当前所在房间码（无则空字符串）
- `onlineAt`: 心跳时间戳

### `rooms`

- `roomCode`, `status`, `difficulty`
- `hostId`, `hostName`, `guestId`, `guestName`
- `questions`（含题干与答案）
- `hostState`, `guestState`（进度同步）
- `memoryEndsAt`, `answerEndsAt`, `startedAt`
- `winner`, `reason`

### `speed_records`

- `playerId`, `nickName`
- `score`, `elapsedMs`
- `createdAt`

## 分享联机

- 创建房间后使用 `wx.shareAppMessage({ query: "roomCode=XXXXXX" })`
- 被邀请者通过 `wx.getLaunchOptionsSync().query.roomCode` 自动进房

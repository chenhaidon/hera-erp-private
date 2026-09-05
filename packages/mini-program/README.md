# 金龙工艺微信小程序

## 微信登录配置

微信小程序一键登录需要配置以下两处：

### 1. 项目 AppID

打开 `project.config.json`，将 `appid` 从占位符替换为微信小程序真实 AppID：

```json
{
  "appid": "wxYOUR_APPID_HERE"
}
```

### 2. 服务端密钥

微信登录由 Supabase Edge Function `wechat_miniapp_login` 处理，需要在 Supabase 项目 secrets 中配置：

- `WECHAT_MINIPROGRAM_LOGIN_APP_ID`
- `WECHAT_MINIPROGRAM_LOGIN_APP_SECRET`

配置后重新部署 Edge Function：

```bash
pnpm run build:weapp
```

## 开发

```bash
pnpm install
pnpm run dev:weapp
```

使用微信开发者工具导入 `packages/mini-program/dist` 目录。

## 构建

```bash
pnpm run build:weapp
```

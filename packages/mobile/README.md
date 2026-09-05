# 金龙工艺移动端

基于 Expo + React Native + Supabase 的移动端应用，与 Web 端共享同一套 Supabase 数据库与认证体系。

## 技术栈

- Expo SDK 51
- React Native 0.74
- Expo Router 3.5（文件系统路由）
- NativeWind / Tailwind CSS
- Supabase Auth + Supabase JS Client
- lucide-react-native（图标）

## 项目结构

```
packages/mobile/
  src/
    app/                  # 页面路由
      _layout.tsx         # 根布局 + 路由守卫
      index.tsx           # 引导页
      (auth)/             # 认证分组
        sign-in.tsx       # 手机号验证码登录
      (app)/              # 业务分组
        (tabs)/           # 底部标签导航
          home.tsx        # 首页工作台
          production.tsx  # 生产工单
          quality.tsx     # 质量检验
          profile.tsx     # 个人中心
        production/[id].tsx
        quality/[id].tsx
        inventory/index.tsx
        inventory/[id].tsx
        marketing/index.tsx
        marketing/[id].tsx
        purchase/index.tsx
        purchase/[id].tsx
        approvals/index.tsx
        approvals/[id].tsx
        settings/index.tsx
        settings/privacy.tsx
        settings/data-list.tsx
        settings/account-cancel.tsx
        scan-report.tsx     # 扫码报工
    client/
      supabase.ts         # Supabase 客户端（expo-sqlite localStorage）
    components/
      ui/                 # 基础 UI 组件
      compliance/         # 隐私合规组件
    ctx.tsx               # SessionProvider + useSession
    lib/
      utils.ts            # cn / 格式化工具
      storage.ts          # 安全存储封装
    types/
      index.ts            # 业务类型定义
```

## 环境变量

在 `packages/mobile/.env` 中配置：

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

注意：移动端使用 `EXPO_PUBLIC_` 前缀，与 Web 端的 `VITE_` 前缀区分。

## 运行

```bash
cd packages/mobile
pnpm install
pnpm start
```

## 主要功能模块

- **登录**：手机号 + 短信验证码，首次登录自动注册；首次启动需同意隐私政策。
- **首页工作台**：待处理工单、待检验、待入库、待审批卡片；快捷入口；今日数据概览。
- **生产管理**：工单列表、工单详情、领料确认、扫码报工。
- **质量管理**：来料 / 过程 / 成品检验列表与判定。
- **库存管理**：成品入库单列表、入库确认、库位分配。
- **营销管理**：销售订单列表、发货操作。
- **采购管理**：采购订单列表、到货发起质检。
- **审批中心**：待审批 / 已审批列表、审批详情、通过 / 驳回。
- **个人中心**：账号信息、设置、隐私设置、双清单、账号注销、退出登录。

## 隐私合规

- 启动时弹出隐私政策弹窗，用户可自主选择同意或不同意。
- 不同意时保留基本功能入口，再次提示后仍不同意则限制需要个人信息的功能。
- 个人中心提供隐私设置、已收集个人信息清单、第三方信息共享清单、账号注销入口。

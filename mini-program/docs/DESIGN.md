## Vibe
- 工业织物秩序感：参考截图中清晰的表格分区、居中标题与二维码信息卡，延续朴素质感与现场可读性。

## Color
- Primary: #7C3AED
- On Primary: #FFFFFF
- Accent: #F59E0B
- On Accent: #FFFFFF
- Background: #F5F5F5
- Foreground: #1F2937
- Muted: #9CA3AF
- Border: #E5E7EB
- Surface: #FFFFFF

## Typography
- Heading: system-ui (family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif, weight: 600)
- Body: system-ui (family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif, weight: 400)

## Visual Language
- 核心视觉签名：白色卡片 + 浅灰背景，信息以表格/两列布局呈现，关键操作使用紫色实心按钮。
- 材质与深度：卡片使用 1px 浅灰边框，无阴影；页面背景浅灰，层次通过卡片白色表面区分。
- 容器与按钮：主按钮为圆角矩形实色填充；次操作为白色描边灰字； destructive 操作使用红色。
- 布局节奏：上下安全区留足 16px 内边距；表单元素垂直排列，间距 16px；二维码区域居中。

## Animation
- 页面切换：无自定义过渡，使用小程序原生导航。
- 按钮反馈：小程序原生按钮反馈。
- 加载状态：使用 wx.showLoading 与骨架屏占位。

## Forbidden
- 禁止大色块铺满背景或卡片。
- 禁止使用 emoji 作为图标或状态标识。
- 禁止动态渐变与毛玻璃效果。

## Additional Notes
- 所有用户可见文案使用中文。
- 扫码页、报工页、质检页需根据当前角色动态展示不同入口与按钮。
- 流转卡详情页需复刻参考截图：左侧标签/值表格，右侧二维码，底部关闭与打印按钮。

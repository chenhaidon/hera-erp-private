import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { AppWrapper } from "./components/common/PageMeta.tsx";
import { useAppStore } from "./store";
import "./index.css";

// 兼容库位二维码：
// 1. 旧二维码直接携带 /mobile/warehouse/location?locationId=xxx
// 2. 新二维码使用 /?r=mobile/warehouse/location&locationId=xxx 入口
// 统一在应用启动时重定向到 hash 路由。
if (typeof window !== "undefined") {
  let targetPath: string | null = null;

  if (
    !window.location.hash &&
    window.location.pathname === "/mobile/warehouse/location" &&
    window.location.search.includes("locationId=")
  ) {
    targetPath = `/mobile/warehouse/location${window.location.search}`;
  } else if (
    !window.location.hash &&
    window.location.pathname === "/" &&
    window.location.search.startsWith("?r=")
  ) {
    const params = new URLSearchParams(window.location.search);
    const r = params.get("r");
    if (r) {
      const restParams = new URLSearchParams();
      params.forEach((value, key) => {
        if (key !== "r") restParams.append(key, value);
      });
      const query = restParams.toString();
      targetPath = `/${r}${query ? `?${query}` : ""}`;
    }
  }

  if (targetPath) {
    // 以当前页面目录为基准构造 hash 路由，兼容子目录部署。
    const base = window.location.href
      .replace(/#.*$/, "")
      .replace(/\?.*$/, "")
      .replace(/\/[^/]*$/, "/");
    const target = `${base}#${targetPath}`;
    window.location.replace(target);
  }
}

Sentry.init({
  dsn: import.meta.env['VITE_SENTRY_DSN'] as string | undefined,
  environment: import.meta.env.MODE,
});

document.documentElement.setAttribute('data-theme', useAppStore.getState().theme);

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary fallback={<p>应用发生错误，请刷新页面重试</p>}>
    <AppWrapper>
      <App />
    </AppWrapper>
  </Sentry.ErrorBoundary>
);

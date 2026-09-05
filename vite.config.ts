import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        icon: true,
        exportType: "named",
        namedExport: "ReactComponent",
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // 第三方库拆分为 vendor chunk
          if (id.includes("node_modules")) {
            if (id.includes("recharts")) return "vendor-charts";
            if (id.includes("lucide-react")) return "vendor-icons";
            if (id.includes("@radix-ui")) return "vendor-ui";
            if (id.includes("framer-motion") || id.includes("motion")) return "vendor-motion";
            if (id.includes("zustand") || id.includes("supabase")) return "vendor-state";
            return "vendor";
          }
          // 按业务模块拆分页面 chunk
          if (id.includes("/src/pages/")) {
            const match = id.match(/\/src\/pages\/([^.]+)/);
            if (match) {
              const name = match[1].replace(/Page$/, "").toLowerCase();
              return `page-${name}`;
            }
          }
        },
      },
    },
  },
});

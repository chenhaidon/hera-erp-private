const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
  path.resolve(__dirname, "../../node_modules"),
];

config.resolver.disableHierarchicalLookup = false;

const defaultResolveRequest = config.resolver.resolveRequest;

// 强制所有 react / react-dom 从 mobile 的 node_modules 统一解析，避免多副本导致 Hook 错误
const reactPath = require.resolve("react", { paths: [path.resolve(__dirname, "node_modules")] });
const reactDomPath = require.resolve("react-dom", { paths: [path.resolve(__dirname, "node_modules")] });

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // 强制 react / react-dom 单例：忽略所有嵌套 node_modules 中的副本
  if (moduleName === "react" || moduleName === "react-dom") {
    const customContext = {
      ...context,
      nodeModulesPaths: [path.resolve(__dirname, "node_modules")],
      disableHierarchicalLookup: true,
    };
    return defaultResolveRequest
      ? defaultResolveRequest(customContext, moduleName, platform)
      : context.resolveRequest(customContext, moduleName, platform);
  }
  if (moduleName === "expo-router/entry") {
    return {
      filePath: require.resolve("expo-router/entry", { paths: [__dirname] }),
      type: "sourceFile",
    };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });

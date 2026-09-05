module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      "babel-preset-expo",
      [
        "@babel/preset-react",
        {
          runtime: "automatic",
          importSource: "react-native-css-interop",
        },
      ],
    ],
    plugins: [
      require.resolve("react-native-css-interop/dist/babel-plugin"),
      "react-native-reanimated/plugin",
    ],
  };
};

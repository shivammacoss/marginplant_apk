module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      [
        "module-resolver",
        {
          alias: {
            "@": "./src",
            "@app": "./app",
            "@assets": "./assets",
            "@core": "./src/core",
            "@shared": "./src/shared",
            "@features": "./src/features",
          },
        },
      ],
      "react-native-worklets/plugin",
    ],
  };
};

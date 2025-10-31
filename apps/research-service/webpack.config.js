const { NxAppWebpackPlugin } = require("@nx/webpack/app-plugin");
const { join } = require("path");
const { composePlugins } = require("@nx/webpack");
const webpack = require("webpack");

module.exports = composePlugins((config, { context }) => ({
  ...config,
  output: {
    path: join(__dirname, "../../dist/apps/research-service")
  },
  externalsPresets: {
    node: true
  },
  // Remove externals - we're using Function constructor in code to bypass webpack
  plugins: [
    // Ignore d3-delaunay completely - it will be loaded at runtime via Function constructor
    new webpack.IgnorePlugin({
      resourceRegExp: /^d3-delaunay$/
    }),
    new NxAppWebpackPlugin({
      target: "node",
      compiler: "tsc",
      main: "./src/main.ts",
      tsConfig: "./tsconfig.app.json",
      assets: ["./src/assets"],
      optimization: false,
      outputHashing: "none",
      generatePackageJson: true
    })
  ]
}));

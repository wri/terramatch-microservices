const { sentryWebpackPlugin } = require("@sentry/webpack-plugin");
const { NxAppWebpackPlugin } = require("@nx/webpack/app-plugin");
const { join } = require("path");
const webpack = require("webpack");
const nodeExternals = require("webpack-node-externals");
const { RunScriptWebpackPlugin } = require("run-script-webpack-plugin");

module.exports = (options, argv) => {
  const isDev = argv.mode === "development";
  const config = {
    output: {
      path: join(__dirname, "../../dist/apps/entity-service"),
      sourceMapFilename: "[file].map"
    },

    plugins: [
      new NxAppWebpackPlugin({
        target: "node",
        compiler: "tsc",
        main: "./src/main.ts",
        tsConfig: "./tsconfig.app.json",
        assets: ["./src/assets"],
        optimization: false,
        outputHashing: "none",
        generatePackageJson: true,
        sourceMap: true
      })
    ],

    devtool: "source-map"
  };

  if (isDev) {
    config.entry = ["webpack/hot/pull?100"];
    config.externals = [nodeExternals({ allowlist: ["webpack/hot/poll?100"] })];
    config.plugins.push(
      new webpack.HotModuleReplacementPlugin(),
      new RunScriptWebpackPlugin({ name: "main.js", autoRestart: false })
    );
  } else {
    config.plugins.push(
      sentryWebpackPlugin({
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: "world-resources-institute-data-lab",
        project: "terramatch-backend"
      })
    );
  }

  return config;
};

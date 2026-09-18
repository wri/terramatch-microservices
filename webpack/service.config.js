const { sentryWebpackPlugin } = require("@sentry/webpack-plugin");
const { NxAppWebpackPlugin } = require("@nx/webpack/app-plugin");
const webpack = require("webpack");
const nodeExternals = require("webpack-node-externals");
const { RunScriptWebpackPlugin } = require("run-script-webpack-plugin");
const { workspaceRoot } = require("nx/src/devkit-exports");

module.exports = ({ projectRoot }, { mode }) => {
  const isDev = mode === "development";
  const config = {
    output: {
      path: `${workspaceRoot}/dist/${projectRoot}`,
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
        sourceMap: true,
        mergeExternals: true
      })
    ],

    devtool: "source-map"
  };

  if (isDev) {
    config.plugins.push(
      {
        apply: compiler => {
          // we have to tweak the entry that NX created
          compiler.options.entry.main.import.unshift("webpack/hot/poll?100");
          // replace the nodeExternals that NX put in place - there cannot be multiple nodeExternals
          // calls in the externals array
          compiler.options.externals = [
            nodeExternals({ modulesDir: `${workspaceRoot}/node_modules`, allowlist: ["webpack/hot/poll?100"] })
          ];
        }
      },
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

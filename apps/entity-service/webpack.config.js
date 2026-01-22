const { sentryWebpackPlugin } = require("@sentry/webpack-plugin");
const { NxAppWebpackPlugin } = require("@nx/webpack/app-plugin");
const { join } = require("path");

module.exports = {
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
    }),
    sentryWebpackPlugin({
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: "wri-terramatch",
      project: "v3-backend"
    })
  ],

  devtool: "source-map"
};

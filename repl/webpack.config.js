const { NxAppWebpackPlugin } = require("@nx/webpack/app-plugin");
const { join } = require("path");
const { composePlugins } = require("@nx/webpack");

module.exports = composePlugins((config, { context }) => ({
  ...config,
  output: {
    path: join(__dirname, `../dist/apps/${context.projectName}-repl`)
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: "node",
      compiler: "tsc",
      main: "./src/repl.ts",
      tsConfig: "./tsconfig.app.json",
      assets: ["./src/assets"],
      optimization: false,
      outputHashing: "none",
      generatePackageJson: true
    })
  ]
}));

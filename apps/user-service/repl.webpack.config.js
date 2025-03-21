const { NxAppWebpackPlugin } = require("@nx/webpack/app-plugin");
const { join } = require("path");

module.exports = {
  output: {
    path: join(__dirname, "../../dist/apps/user-service-repl")
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
};

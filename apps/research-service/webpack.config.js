const { NxAppWebpackPlugin } = require("@nx/webpack/app-plugin");
const { join } = require("path");

module.exports = {
  output: {
    path: join(__dirname, "../../dist/apps/research-service")
  },
  externals: [
    // Externalize JSTS to avoid ESM bundling issues
    function ({ request }, callback) {
      // Externalize all jsts imports (including deep imports like jsts/org/locationtech/...)
      if (request && request.startsWith("jsts")) {
        return callback(null, "commonjs " + request);
      }
      callback();
    }
  ],
  plugins: [
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
};

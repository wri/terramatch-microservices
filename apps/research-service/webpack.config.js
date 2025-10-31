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
  externals: [
    function ({ request }, callback) {
      if (request === "d3-delaunay") {
        return callback(null, "commonjs " + request);
      }
      if (config.externals != null) {
        if (typeof config.externals === "function") {
          return config.externals({ request }, callback);
        }
        if (Array.isArray(config.externals)) {
          for (const ext of config.externals) {
            if (typeof ext === "function") {
              const result = ext({ request }, callback);
              if (result !== undefined) return;
            }
          }
        }
      }
      callback();
    }
  ],
  plugins: [
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

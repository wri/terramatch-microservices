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
    // Externalize d3-delaunay completely - prevent webpack from processing it
    function ({ request }, callback) {
      if (request === "d3-delaunay") {
        // Return a function that Node.js will call at runtime
        // This prevents webpack from trying to bundle it
        return callback(null, "commonjs " + request);
      }
      // Preserve existing externals from Nx config
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
    // Ignore d3-delaunay during static analysis to prevent webpack from processing it
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

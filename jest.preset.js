const nxPreset = require("@nx/jest/preset").default;

module.exports = {
  ...nxPreset,

  coverageThreshold: {
    global: {
      // The branches value is low because conditional chaining (?.) and nullish coalescing (??)
      // create branches in the transpiled code. Istanbul (the coverage tool) does not provide a way
      // to differentiate between those branches and real code branches, and testing every branch of
      // a conditional chain is very tedious and not very useful.
      // https://github.com/istanbuljs/istanbuljs/issues/526
      branches: 75,
      functions: 95,
      lines: 95,
      statements: 95
    }
  },

  setupFilesAfterEnv: ["./jest/setup-jest.ts"]
};

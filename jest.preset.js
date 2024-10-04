const nxPreset = require('@nx/jest/preset').default;

module.exports = {
  ...nxPreset,

  coverageThreshold: {
    global: {
      branches: 85,
      functions: 95,
      lines: 95,
      statements: 95,
    }
  },

  setupFilesAfterEnv: ['./setup-jest.ts'],
}

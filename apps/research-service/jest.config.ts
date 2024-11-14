/* eslint-disable */
export default {
  displayName: "research-service",
  preset: "../../jest.preset.js",
  testEnvironment: "node",
  transform: {
    "^.+\\.[tj]s$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.spec.json" }]
  },
  moduleFileExtensions: ["ts", "js", "html"],
  coveragePathIgnorePatterns: [".dto.ts"],
  coverageDirectory: "../../coverage/apps/research-service"
};

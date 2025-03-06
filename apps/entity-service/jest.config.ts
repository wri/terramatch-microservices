/* eslint-disable */
export default {
  displayName: "entity-service",
  preset: "../../jest.preset.js",
  testEnvironment: "node",
  transform: {
    "^.+\\.[tj]s$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.spec.json" }]
  },
  moduleFileExtensions: ["ts", "js", "html"],
  coveragePathIgnorePatterns: [".dto.ts"],
  coverageDirectory: "../../coverage/apps/entity-service"
};

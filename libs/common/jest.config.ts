/* eslint-disable */
export default {
  displayName: "common",
  preset: "../../jest.preset.js",
  testEnvironment: "node",
  transform: {
    "^.+\\.[tj]s$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.spec.json" }]
  },
  moduleFileExtensions: ["ts", "js", "html"],
  coverageDirectory: "../../coverage/libs/common",
  coveragePathIgnorePatterns: ["util/tm-log.service.ts"]
};

/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 */

export default {
    preset: "ts-jest",
    testEnvironment: "jsdom",
    moduleNameMapper: {
        onek: "<rootDir>/src/",
    },
    collectCoverage: true,
    coverageDirectory: "coverage",
    coverageProvider: "v8",
    coverageReporters: ["json", "lcov", "text-summary", "html"],
    transform: {
        "^.+\\.tsx?$": [
            "ts-jest",
            {
                tsconfig: "tsconfig.json",
                diagnostics: true,
                isolatedModules: true,
                react: "detect",
            },
        ],
    },
};

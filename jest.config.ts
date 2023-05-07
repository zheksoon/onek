/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 */

export default {
    collectCoverage: true,
    coverageDirectory: "coverage",
    coverageProvider: "v8",
    coverageReporters: ['json', 'lcov', 'text-summary', 'html'],
    transform: {
        "^.+\\.tsx?$": "ts-jest",
    },
};

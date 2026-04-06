/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    // Match the path aliases in tsconfig.json
    '^@db$': '<rootDir>/db/index.ts',
    '^@db/schema$': '<rootDir>/db/schema.ts',
    '^@db/(.*)$': '<rootDir>/db/$1',
    '^@server/(.*)$': '<rootDir>/server/$1',
    '^openai$': '<rootDir>/server/tests/mocks/openai.ts'
  },
  setupFilesAfterEnv: [
    '<rootDir>/server/tests/setup.ts'
  ],
  testMatch: [
    '**/server/tests/**/*.test.ts'
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      isolatedModules: true,
      useESM: true
    }]
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  verbose: true,
  testTimeout: 10000, // 10 second timeout for tests
  collectCoverage: true,
  collectCoverageFrom: [
    'server/services/**/*.ts',
    'server/cron/**/*.ts',
    'server/openai.ts',
    '!**/node_modules/**'
  ],
  coverageDirectory: './coverage'
};

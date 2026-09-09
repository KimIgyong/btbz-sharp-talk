/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  // Resolve @sharptalk/types to the package source (not the built dist) so tests
  // run against current source without requiring a prior build.
  moduleNameMapper: {
    '^@sharptalk/types$': '<rootDir>/../types/src/index.ts',
    '^@sharptalk/(.*)$': '<rootDir>/../$1/src',
  },
};

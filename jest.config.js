module.exports = {
  preset: 'jest-expo',
  watchman: false,
  testMatch: ['<rootDir>/tests/**/*.test.[jt]s?(x)'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  collectCoverageFrom: ['src/lib/**/*.{ts,tsx}', 'src/providers/**/*.{ts,tsx}'],
};

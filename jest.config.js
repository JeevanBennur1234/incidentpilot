module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverage: true,
  collectCoverageFrom: [
    'agent/**/*.js',
    '!agent/sandbox/daytona.js',
    '!agent/cli.js',
    '!agent/create-and-push-repo.js',
    '!agent/servers/**/*.js'
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 75,
      lines: 75,
      statements: 75
    }
  }
};

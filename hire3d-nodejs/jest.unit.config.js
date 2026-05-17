'use strict';

module.exports = {
  testEnvironment: 'node',
  setupFiles: ['./tests/setup/env.js'],
  testMatch: ['**/tests/unit/**/*.test.js'],
  testTimeout: 10000,
  maxWorkers: 1,
  transformIgnorePatterns: ['/node_modules/(?!(@scure|@noble)/)'],
};

'use strict';

module.exports = {
  testEnvironment: 'node',
  globalSetup: './tests/setup/globalSetup.js',
  setupFiles: ['./tests/setup/env.js'],
  testMatch: ['**/tests/**/*.test.js'],
  testTimeout: 30000,
  maxWorkers: 1,
  // otplib's transitive deps (@scure/base, @noble/hashes) ship ESM-only;
  // transform them so Jest's CJS environment can load them.
  transformIgnorePatterns: ['/node_modules/(?!(@scure|@noble)/)'],
};

/** Jest config for testing plain Node.js scripts (no React Native / Expo transform). */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/unit/scripts/**/*.test.js'],
  transform: {},
  testPathIgnorePatterns: ['/node_modules/', '/.claude/', '/.worktrees/'],
};

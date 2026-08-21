/** Jest config for testing plain Node.js scripts (no React Native / Expo transform). */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/unit/scripts/**/*.test.{js,ts}'],
  // .js specs stay untransformed (plain CommonJS); only .ts needs babel to
  // strip types, so pattern this narrowly rather than widening transform: {}.
  transform: { '\\.ts$': 'babel-jest' },
  // Fails the run if any test leaves the working tree dirtier than it found
  // it (see #712 — versionCode bumps + node_modules/.bin deletion).
  globalSetup: '<rootDir>/__tests__/unit/scripts/_globalSetup.js',
  globalTeardown: '<rootDir>/__tests__/unit/scripts/_globalTeardown.js',
  testPathIgnorePatterns: ['/node_modules/', '/.claude/', '/.worktrees/'],
  // testPathIgnorePatterns only filters test discovery; jest-haste-map still
  // crawls rootDir and indexes any worktree checked out under it, colliding on
  // the duplicate package.json name and __mocks__/.
  modulePathIgnorePatterns: ['<rootDir>/.worktrees/'],
};

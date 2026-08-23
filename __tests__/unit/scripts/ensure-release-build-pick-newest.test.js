/**
 * @jest-environment node
 *
 * Unit tests for pickNewestBuild() in e2e/ensure-release-build.js: DerivedData
 * is a single machine-wide directory, so every worktree that has ever run a
 * Release build leaves its own `Threadbase-<hash>` folder there, and
 * `readdirSync` order is filesystem order, not recency. This pure function
 * decides which candidate `findReleaseBuild()` should return; it takes no
 * filesystem input so it's testable without touching real DerivedData.
 */

'use strict';

const { pickNewestBuild } = require('../../../e2e/ensure-release-build');

test('the candidate with the newest builtAt wins regardless of array order', () => {
  const older = { path: '/a', stamp: { sha: 'a', builtAt: '2026-08-01T00:00:00.000Z' } };
  const newer = { path: '/b', stamp: { sha: 'b', builtAt: '2026-08-20T00:00:00.000Z' } };

  expect(pickNewestBuild([older, newer])).toBe('/b');
  expect(pickNewestBuild([newer, older])).toBe('/b');
});

test('an unstamped candidate loses to any stamped candidate', () => {
  const unstamped = { path: '/unstamped', stamp: null };
  const stamped = { path: '/stamped', stamp: { sha: 'a', builtAt: '2020-01-01T00:00:00.000Z' } };

  expect(pickNewestBuild([unstamped, stamped])).toBe('/stamped');
  expect(pickNewestBuild([stamped, unstamped])).toBe('/stamped');
});

test('a single candidate is returned even if unstamped', () => {
  expect(pickNewestBuild([{ path: '/only', stamp: null }])).toBe('/only');
});

test('an empty candidate list returns null', () => {
  expect(pickNewestBuild([])).toBeNull();
});

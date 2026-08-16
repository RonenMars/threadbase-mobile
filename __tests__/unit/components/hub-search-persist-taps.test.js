/**
 * @jest-environment node
 *
 * Every hub list that can show search results must set
 * `keyboardShouldPersistTaps`.
 *
 * The hub search bar autoFocuses, so the keyboard is up when the first result
 * appears. React Native's ScrollView default is `"never"`, which spends that
 * first tap dismissing the keyboard and never delivers it to the row — the tap
 * looks like it landed, the keyboard disappears, and nothing opens. The user
 * has to tap the same row twice.
 *
 * It cost `06_search_anchor` four red Android E2E runs before the failure was
 * read correctly: Maestro reported the tap as COMPLETED and then failed on a
 * later assertion, and the mock server logged no request at all, so the flow
 * name pointed at anchored search while the defect was in the list.
 *
 * A source check rather than a render test because mounting the hub needs the
 * servers store, React Query, the theme context and expo-router; the prop is
 * the whole fix, and this is the assertion that fails if it is dropped.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');

const SEARCH_RESULT_LISTS = [
  'app/index.tsx',
  'components/sessions/tree/TreeSessionsList.tsx',
  'components/sessions/hub/ProjectHubList.tsx',
];

describe('hub search results keep taps', () => {
  test.each(SEARCH_RESULT_LISTS)('%s sets keyboardShouldPersistTaps', (file) => {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    expect(source).toContain('keyboardShouldPersistTaps="handled"');
  });
});

# FlashList v2 hooks must be stubbed in the Jest mock

**Date:** 2026-05-22
**Status:** Resolved

## Symptom

22 tests across `ToolCard.test.tsx` and `MessageBubble.test.tsx` failed with:

```
TypeError: (0 , _flashList.useRecyclingState) is not a function
```

Failures looked unrelated to FlashList — they hit on `getByText('Edit')`, `accessibility label includes tool name`, etc. — so it was easy to misdiagnose as a component-API mismatch.

## Cause

`jest.setup.js` mocks `@shopify/flash-list` to render `FlashList` as a plain `FlatList`. That mock exported only `FlashList` — not the v2 hooks (`useRecyclingState`, `useLayoutState`) that `ToolCard`, `ThinkingCard`, `DiffViewer`, and (formerly) `MessageBubble` call in their bodies. Any test that rendered a component using those hooks crashed before the assertion ran.

## The fix

Extend the mock to stub both hooks as plain `React.useState`. The dep-array reset behavior of `useRecyclingState` and the FlashList re-layout trigger of `useLayoutState` don't apply when FlashList is mocked to a `FlatList` — `useState` is a faithful enough stub for unit tests.

```js
jest.mock('@shopify/flash-list', () => {
  const React = require('react')
  const { FlatList } = require('react-native')
  return {
    __esModule: true,
    FlashList: React.forwardRef((props, ref) => React.createElement(FlatList, { ...props, ref })),
    useRecyclingState: (initial) => React.useState(typeof initial === 'function' ? initial() : initial),
    useLayoutState: (initial) => React.useState(typeof initial === 'function' ? initial() : initial),
  }
})
```

## What to do next time

- When adding a new FlashList v2 hook anywhere in `components/conversation/`, confirm the Jest mock exposes it. The error message names the missing function — start there.
- If tests on a component start failing for what looks like an "unrelated" reason after a FlashList-adjacent change, run the test file in isolation and read the stack trace — it usually points right at the missing hook.

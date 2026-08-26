// v3 GestureDetector throws unless it sits under GestureHandlerRootView.
// Tests don't fire gestures and wrapping every RTL render would make
// `toJSON() === null` empty-state assertions fail (the root view is a View).
// Mapped over the package's relative import via jest.moduleNameMapper.
module.exports = { useEnsureGestureHandlerRootView: () => {} }

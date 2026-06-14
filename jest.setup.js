const matchers = require('@testing-library/react-native/matchers')
expect.extend(matchers)

require('./test-utils/i18n-setup')

global.__DEV__ = true

// ─── expo-router ─────────────────────────────────────────────────────────────
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    navigate: jest.fn(),
    canGoBack: jest.fn(() => true),
  })),
  useLocalSearchParams: jest.fn(() => ({})),
  useGlobalSearchParams: jest.fn(() => ({})),
  useNavigation: jest.fn(() => ({ setOptions: jest.fn() })),
  useSegments: jest.fn(() => []),
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  Redirect: () => null,
  Link: ({ children }) => children,
  Stack: { Screen: () => null },
  Tabs: { Screen: () => null },
}))

// ─── expo-haptics ────────────────────────────────────────────────────────────
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
  NotificationFeedbackType: { Success: 'Success', Warning: 'Warning', Error: 'Error' },
}))

// ─── expo-clipboard ──────────────────────────────────────────────────────────
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
  getStringAsync: jest.fn().mockResolvedValue(''),
}))

// ─── expo-camera ─────────────────────────────────────────────────────────────
// The real `useCameraPermissions` hook resolves its initial status
// asynchronously, which fires a setState after Jest tears the test down and
// floods CI logs with "update to PairScannerModal was not wrapped in act(...)"
// warnings. Returning a synchronous granted-permission tuple avoids the
// post-teardown setState entirely.
jest.mock('expo-camera', () => {
  const React = require('react')
  return {
    CameraView: ({ children }) => React.createElement('CameraView', null, children),
    useCameraPermissions: () => [
      { granted: true, canAskAgain: true, status: 'granted' },
      jest.fn().mockResolvedValue({ granted: true, canAskAgain: true, status: 'granted' }),
    ],
  }
})

// ─── expo-secure-store ───────────────────────────────────────────────────────
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}))

// ─── @react-native-async-storage ─────────────────────────────────────────────
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn().mockResolvedValue(undefined),
    getItem: jest.fn().mockResolvedValue(null),
    removeItem: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
    getAllKeys: jest.fn().mockResolvedValue([]),
    multiGet: jest.fn().mockResolvedValue([]),
    multiSet: jest.fn().mockResolvedValue(undefined),
  },
}))

// ─── expo-notifications ──────────────────────────────────────────────────────
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[test-token]' }),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('notification-id'),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  setBadgeCountAsync: jest.fn().mockResolvedValue(undefined),
  AndroidImportance: { HIGH: 5, DEFAULT: 3 },
}))

// ─── @shopify/flash-list ──────────────────────────────────────────────────────
jest.mock('@shopify/flash-list', () => {
  const React = require('react')
  const { FlatList } = require('react-native')
  return {
    __esModule: true,
    FlashList: React.forwardRef((props, ref) => React.createElement(FlatList, { ...props, ref })),
    // Stubs for FlashList v2 hooks consumers (ToolCard, ThinkingCard, DiffViewer).
    // Both reduce to plain React.useState under test: dep-based reset and
    // layout notifications don't apply to a FlatList-based mock.
    useRecyclingState: (initial) => React.useState(typeof initial === 'function' ? initial() : initial),
    useLayoutState: (initial) => React.useState(typeof initial === 'function' ? initial() : initial),
  }
})

// ─── @gorhom/bottom-sheet ────────────────────────────────────────────────────
jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react')
  const { View, TextInput } = require('react-native')
  const MockBottomSheet = React.forwardRef(({ children }, ref) => {
    React.useImperativeHandle(ref, () => ({
      expand: jest.fn(),
      collapse: jest.fn(),
      close: jest.fn(),
      snapToIndex: jest.fn(),
    }))
    return React.createElement(View, { testID: 'bottom-sheet' }, children)
  })
  return {
    __esModule: true,
    default: MockBottomSheet,
    BottomSheetView: ({ children }) => React.createElement(View, {}, children),
    BottomSheetScrollView: ({ children }) => React.createElement(View, {}, children),
    BottomSheetFlatList: React.forwardRef((props, ref) => {
      const { FlatList } = require('react-native')
      return React.createElement(FlatList, { ...props, ref })
    }),
    BottomSheetTextInput: (props) => React.createElement(TextInput, props),
    useBottomSheet: () => ({ expand: jest.fn(), collapse: jest.fn(), close: jest.fn() }),
  }
})

// ─── react-native-draggable-flatlist ─────────────────────────────────────────
jest.mock('react-native-draggable-flatlist', () => {
  const React = require('react')
  const { View } = require('react-native')
  const listMock = (testID) => ({ data = [], renderItem }) =>
    React.createElement(
      View,
      { testID },
      data.map((item, index) =>
        renderItem({ item, index, drag: jest.fn(), isActive: false, getIndex: () => index })
      )
    )
  return {
    __esModule: true,
    default: listMock('draggable-flatlist'),
    NestableDraggableFlatList: listMock('draggable-flatlist'),
    NestableScrollContainer: ({ children, ...props }) => React.createElement(View, props, children),
  }
})

// ─── react-native-safe-area-context ──────────────────────────────────────────
jest.mock('react-native-safe-area-context', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    __esModule: true,
    SafeAreaView: ({ children, ...props }) => React.createElement(View, props, children),
    SafeAreaProvider: ({ children }) => React.createElement(View, {}, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 375, height: 812 }),
    initialWindowMetrics: {
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
      frame: { x: 0, y: 0, width: 375, height: 812 },
    },
  }
})

// ─── react-native-pager-view ─────────────────────────────────────────────────
jest.mock('react-native-pager-view', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    __esModule: true,
    default: React.forwardRef(({ children }, ref) => React.createElement(View, { ref }, children)),
  }
})

// ─── expo-constants ──────────────────────────────────────────────────────────
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      version: '1.0.0',
      ios: { buildNumber: '1' },
      android: { versionCode: 1 },
    },
  },
}))

// ─── expo-router/react-navigation (useHeaderHeight escape hatch) ─────────────
// SDK 56: useHeaderHeight moved here from @react-navigation/elements (which is
// no longer a direct dep). See app usage at components/servers/AddServerScreen.tsx.
jest.mock('expo-router/react-navigation', () => ({
  useHeaderHeight: () => 44,
}))

// ─── expo-speech-recognition ─────────────────────────────────────────────────
jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    requestPermissionsAsync: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
  },
  useSpeechRecognitionEvent: jest.fn(),
}))

// ─── react-native-keyboard-controller ────────────────────────────────────────
jest.mock('react-native-keyboard-controller', () => {
  const React = require('react')
  return {
    KeyboardProvider: ({ children }) => children,
    KeyboardAwareScrollView: React.forwardRef(({ children, contentContainerStyle, ...props }, ref) =>
      React.createElement('ScrollView', { ...props, contentContainerStyle, ref }, children)
    ),
  }
})

// ─── WebSocket global (for ws-client tests) ──────────────────────────────────
global.WebSocket = global.WebSocket || class {}

// ─── ThemeContext ─────────────────────────────────────────────────────────────
// All tests run with the dark theme so components using useTheme() don't
// require a ThemeProvider wrapper in test renders.
jest.mock('@/contexts/ThemeContext', () => {
  const { dark } = require('./constants/theme')
  return {
    useTheme: () => dark,
    ThemeProvider: ({ children }) => children,
  }
})

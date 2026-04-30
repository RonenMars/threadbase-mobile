const matchers = require('@testing-library/react-native/matchers')
expect.extend(matchers)

global.__DEV__ = true

// ─── expo-router ─────────────────────────────────────────────────────────────
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    navigate: jest.fn(),
  })),
  useLocalSearchParams: jest.fn(() => ({})),
  useGlobalSearchParams: jest.fn(() => ({})),
  useNavigation: jest.fn(() => ({ setOptions: jest.fn() })),
  useSegments: jest.fn(() => []),
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
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
  return {
    __esModule: true,
    default: ({ data = [], renderItem }) =>
      React.createElement(
        View,
        { testID: 'draggable-flatlist' },
        data.map((item, index) =>
          renderItem({ item, index, drag: jest.fn(), isActive: false })
        )
      ),
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

// ─── @react-navigation/elements ──────────────────────────────────────────────
jest.mock('@react-navigation/elements', () => ({
  useHeaderHeight: () => 44,
  HeaderButton: () => null,
  HeaderTitle: () => null,
  HeaderBackButton: () => null,
}))

// ─── WebSocket global (for ws-client tests) ──────────────────────────────────
global.WebSocket = global.WebSocket || class {}

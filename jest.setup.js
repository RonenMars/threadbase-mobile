const matchers = require('@testing-library/react-native/matchers')
expect.extend(matchers)

require('./test-utils/i18n-setup')

global.__DEV__ = true

// gesture-handler v3 calls native installUIRuntimeBindings at import; its
// jestSetup stubs the native module so that NOOP doesn't throw under Jest.
require('react-native-gesture-handler/jestSetup')

// query-client wires onlineManager to NetInfo at import; without a stub the
// native module yields undefined state and the listener throws. Default to
// "connected"; per-file mocks (e.g. query-client.test) override to drive
// connectivity transitions.
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()),
    fetch: jest.fn(() =>
      Promise.resolve({ isConnected: true, isInternetReachable: true }),
    ),
  },
}))

// ─── expo-router ─────────────────────────────────────────────────────────────
jest.mock('expo-router', () => {
  const React = require('react')
  return {
    useRouter: jest.fn(() => ({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      navigate: jest.fn(),
      setParams: jest.fn(),
      canGoBack: jest.fn(() => true),
    })),
    useLocalSearchParams: jest.fn(() => ({})),
    useGlobalSearchParams: jest.fn(() => ({})),
    useNavigation: jest.fn(() => ({ setOptions: jest.fn(), addListener: jest.fn(() => jest.fn()) })),
    useSegments: jest.fn(() => []),
    // Screens are always focused under test — run the effect on mount and
    // return its cleanup so blur/unmount tears the interval down.
    useFocusEffect: (cb) => {
      React.useEffect(() => cb(), [cb])
    },
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
    Redirect: () => null,
    Link: ({ children }) => children,
    Stack: { Screen: () => null },
    Tabs: { Screen: () => null },
  }
})

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
//
// The tuple must keep a STABLE reference across renders, mirroring the real
// hook. Consumers (usePermissionsStatus) put `cameraPermission` in a useEffect
// dependency array; a fresh object per call would make that effect's setState
// re-run every render → "Maximum update depth exceeded".
jest.mock('expo-camera', () => {
  const React = require('react')
  const cameraPermission = { granted: true, canAskAgain: true, status: 'granted' }
  const requestCameraPermission = jest.fn().mockResolvedValue(cameraPermission)
  const cameraPermissionTuple = [cameraPermission, requestCameraPermission]
  return {
    CameraView: ({ children }) => React.createElement('CameraView', null, children),
    useCameraPermissions: () => cameraPermissionTuple,
  }
})

// ─── expo-secure-store ───────────────────────────────────────────────────────
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}))

// ─── expo-device ─────────────────────────────────────────────────────────────
// Tests exercise the real-device code path (simulators are guarded out).
jest.mock('expo-device', () => ({
  get isDevice() {
    return true
  },
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

// ─── expo-widgets / live activity ────────────────────────────────────────────
// The widget module is mocked rather than `expo-widgets` itself: its layout
// carries the `'widget'` directive, which only Babel's widget transform can
// resolve — under Jest the JSX would reference undefined SwiftUI globals.
// `start()` returns a fresh handle per call so eviction tests can assert which
// activity was ended.
jest.mock('@/widgets/SessionLiveActivity', () => ({
  __esModule: true,
  default: {
    start: jest.fn(() => ({
      update: jest.fn().mockResolvedValue(undefined),
      end: jest.fn().mockResolvedValue(undefined),
      getPushToken: jest.fn().mockResolvedValue(null),
    })),
    getInstances: jest.fn(() => []),
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
  // Cold-start read-back: null means "the app was not launched by a tap".
  getLastNotificationResponseAsync: jest.fn().mockResolvedValue(null),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(null),
  dismissNotificationAsync: jest.fn().mockResolvedValue(undefined),
  getPresentedNotificationsAsync: jest.fn().mockResolvedValue([]),
  setBadgeCountAsync: jest.fn().mockResolvedValue(undefined),
  AndroidImportance: { HIGH: 5, DEFAULT: 3 },
}))

// ─── expo-image-picker ───────────────────────────────────────────────────────
jest.mock('expo-image-picker', () => ({
  getMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true, assets: [] }),
  launchCameraAsync: jest.fn().mockResolvedValue({ canceled: true, assets: [] }),
}))

// ─── expo-image-manipulator ──────────────────────────────────────────────────
jest.mock('expo-image-manipulator', () => ({
  __esModule: true,
  manipulateAsync: jest.fn().mockResolvedValue({ uri: 'file:///tmp/shot.jpg', width: 1400, height: 900 }),
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
}))

// ─── expo-file-system/legacy ─────────────────────────────────────────────────
jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 120000 }),
  readAsStringAsync: jest.fn().mockResolvedValue(''),
  EncodingType: { Base64: 'base64' },
}))

// ─── @shopify/flash-list ──────────────────────────────────────────────────────
jest.mock('@shopify/flash-list', () => {
  const React = require('react')
  const { FlatList } = require('react-native')
  return {
    __esModule: true,
    // Real FlashList's imperative scroll methods resolve offscreen indices
    // internally and never throw FlatList's getItemLayout invariant. Expose
    // no-op scroll stubs on the ref so tests that call scrollToIndex/End/Offset
    // (e.g. search-match nav) don't trip that FlatList-only invariant.
    FlashList: React.forwardRef((props, ref) => {
      const innerRef = React.useRef(null)
      React.useImperativeHandle(ref, () => ({
        scrollToIndex: () => Promise.resolve(),
        scrollToEnd: () => {},
        scrollToOffset: () => {},
      }))
      // Real FlashList fires onLoad once it has drawn items; the skeleton gate
      // depends on it. FlatList has no such callback, so emit it once on mount
      // (skipped when a ListEmptyComponent would render, matching real behavior).
      const { onLoad, onStartReached, onStartReachedThreshold, maintainVisibleContentPosition, ...flatProps } = props
      React.useEffect(() => {
        if (onLoad && (props.data?.length ?? 0) > 0) onLoad({ elapsedTimeInMs: 0 })
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      return React.createElement(FlatList, { ...flatProps, ref: innerRef })
    }),
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

// ─── expo-mail-composer ──────────────────────────────────────────────────────
jest.mock('expo-mail-composer', () => ({
  __esModule: true,
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  composeAsync: jest.fn().mockResolvedValue({ status: 'sent' }),
  MailComposerStatus: {
    UNDETERMINED: 'undetermined',
    SENT: 'sent',
    SAVED: 'saved',
    CANCELLED: 'cancelled',
  },
}))

// ─── expo-updates ────────────────────────────────────────────────────────────
jest.mock('expo-updates', () => ({
  __esModule: true,
  reloadAsync: jest.fn().mockResolvedValue(undefined),
  updateId: null,
  channel: null,
  runtimeVersion: '1.0.0',
  isEmbeddedLaunch: true,
}))

// ─── @sentry/react-native ────────────────────────────────────────────────────
// A lightweight mock that records init/close/setUser/setTag and lets tests
// drive the beforeSend/beforeBreadcrumb hooks the service passes in. No native
// module is loaded.
jest.mock('@sentry/react-native', () => {
  const scope = {
    setUser: jest.fn(),
    setTag: jest.fn(),
    setTags: jest.fn(),
    setContext: jest.fn(),
    setExtra: jest.fn(),
  }
  return {
    __esModule: true,
    init: jest.fn(),
    close: jest.fn().mockResolvedValue(true),
    flush: jest.fn().mockResolvedValue(true),
    captureException: jest.fn(() => 'evt_exception'),
    captureMessage: jest.fn(() => 'evt_message'),
    captureFeedback: jest.fn(() => 'evt_feedback'),
    lastEventId: jest.fn(() => undefined),
    addBreadcrumb: jest.fn(),
    getGlobalScope: jest.fn(() => scope),
    getCurrentScope: jest.fn(() => scope),
    setUser: jest.fn(),
    setTag: jest.fn(),
    setTags: jest.fn(),
    withScope: jest.fn((cb) => cb(scope)),
    wrap: jest.fn((c) => c),
    ErrorBoundary: ({ children }) => children,
    __scope: scope,
  }
})

// ─── expo-router/react-navigation (useHeaderHeight escape hatch) ─────────────
// SDK 56: useHeaderHeight moved here from @react-navigation/elements (which is
// no longer a direct dep). See app usage at components/servers/AddServerScreen.tsx.
jest.mock('expo-router/react-navigation', () => ({
  useHeaderHeight: () => 44,
}))

// ─── expo-speech-recognition ─────────────────────────────────────────────────
jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
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
    KeyboardAvoidingView: ({ children, ...props }) => React.createElement('View', props, children),
    useKeyboardState: (selector) => {
      const state = { isVisible: false, height: 0 }
      return selector ? selector(state) : state
    },
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
    useIsGlass: () => dark.glass !== undefined,
    ThemeProvider: ({ children }) => children,
  }
})

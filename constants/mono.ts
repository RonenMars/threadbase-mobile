import { Platform } from 'react-native'

/** The app's mono stack; no font dependency (docs/design/session-list, audit correction 4). */
export const MONO_FONT = Platform.OS === 'ios' ? 'Menlo' : 'monospace'

import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui'
import {
  font,
  foregroundColor,
  lineLimit,
  minimumScaleFactor,
  padding,
} from '@expo/ui/swift-ui/modifiers'
import { createLiveActivity } from 'expo-widgets'

import type { LiveSessionState } from '@/types/live-activity'

/**
 * The layout function below carries the `'widget'` directive, which Babel
 * serializes to a source string that runs inside the widget extension's own
 * bundle (see `babel-preset-expo`'s widgets-plugin). That bundle injects
 * `@expo/ui/swift-ui` and its modifiers as globals, so the imports above exist
 * only to type-check the JSX — at runtime the serialized function resolves
 * those same names from the extension's globals. Nothing else is in scope: the
 * function cannot close over module constants or shared helpers, which is why
 * every other value it needs is inlined.
 *
 * That isolation is also why colors are literals rather than `constants/theme`
 * tokens: they are the `dark` / `light` palette's `status.running`,
 * `status.waiting`, `text.primary`, and `text.secondary` values, kept in sync by
 * hand. Icons are SF Symbols rather than Phosphor for the same reason — Phosphor
 * is a React Native view library and there is no RN renderer in this process.
 */
const SessionLiveActivity = createLiveActivity<LiveSessionState>(
  'SessionLiveActivity',
  (props, environment) => {
    'widget'

    const isDark = environment.colorScheme === 'dark'
    const isWaiting = props.status === 'waiting_input'

    const statusColor = isWaiting
      ? isDark
        ? '#d29922'
        : '#9a6700'
      : isDark
        ? '#3fb950'
        : '#1a7f37'
    const primaryText = isDark ? '#e6edf3' : '#1f2328'
    const secondaryText = isDark ? '#7d8590' : '#57606a'
    const statusSymbol = isWaiting ? 'questionmark.circle.fill' : 'circle.dotted'
    const statusLabel = isWaiting ? 'Waiting for input' : 'Running'

    // A live surface renders a self-ticking native timer counting up from the
    // session's start, so the range only needs a floor — never a per-second push.
    const startedAt = new Date(props.startedAt)
    const elapsed = { lower: startedAt, upper: startedAt }

    return {
      banner: (
        <VStack alignment="leading" spacing={6} modifiers={[padding({ all: 14 })]}>
          <HStack spacing={8}>
            <Image systemName={statusSymbol} size={14} color={statusColor} />
            <Text
              modifiers={[
                font({ textStyle: 'headline' }),
                foregroundColor(primaryText),
                lineLimit(1),
              ]}
            >
              {props.projectName}
            </Text>
            <Spacer />
            <Text
              timerInterval={elapsed}
              countsDown={false}
              modifiers={[
                font({ textStyle: 'headline', design: 'monospaced' }),
                foregroundColor(statusColor),
              ]}
            />
          </HStack>
          <Text
            modifiers={[font({ textStyle: 'caption' }), foregroundColor(statusColor), lineLimit(1)]}
          >
            {statusLabel}
          </Text>
          <Text
            modifiers={[
              font({ textStyle: 'caption', design: 'monospaced' }),
              foregroundColor(secondaryText),
              lineLimit(2),
              minimumScaleFactor(0.8),
            ]}
          >
            {props.lastOutput}
          </Text>
        </VStack>
      ),
      compactLeading: <Image systemName={statusSymbol} size={12} color={statusColor} />,
      compactTrailing: (
        <Text
          timerInterval={elapsed}
          countsDown={false}
          modifiers={[
            font({ textStyle: 'caption2', design: 'monospaced' }),
            foregroundColor(statusColor),
          ]}
        />
      ),
      // `minimal` and the four `expanded*` regions are deliberately omitted in
      // v1 — the system renders acceptable defaults for both, and compact is the
      // state the Island occupies almost all of the time. Do not hand-style them
      // without revisiting that decision.
    }
  },
)

export default SessionLiveActivity

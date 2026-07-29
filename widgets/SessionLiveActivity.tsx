import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui'
import {
  clipShape,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  minimumScaleFactor,
  padding,
  resizable,
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
 * That isolation is also why the status colors are literals rather than
 * `constants/theme` tokens: they are the `dark` / `light` palette's
 * `status.running` and `status.completed` values, kept in sync by hand. Title
 * and body text use SwiftUI's hierarchical `primary` / `secondary` styles
 * instead, so the system resolves them against whatever material it draws the
 * activity on. Icons are SF Symbols rather than Phosphor for the same reason
 * — Phosphor is a React Native view library and there is no RN renderer in
 * this process.
 *
 * `status: 'waiting_input'` is always this surface's terminal frame, never an
 * ongoing one — `services/live-activity.ts` only ever delivers it as the
 * final state passed to `end()`, matching the streamer's per-turn push design
 * (docs/guides/live-activity-push.md in tb-streamer): a turn closes, not the
 * session, so this renders "Finished" rather than "Waiting for input".
 */
const SessionLiveActivity = createLiveActivity<LiveSessionState>(
  'SessionLiveActivity',
  (props, environment) => {
    'widget'

    const isDark = environment.colorScheme === 'dark'
    const isFinished = props.status === 'waiting_input'

    const statusColor = isFinished
      ? isDark
        ? '#58a6ff'
        : '#0969da'
      : isDark
        ? '#3fb950'
        : '#1a7f37'
    const statusSymbol = isFinished ? 'checkmark.circle.fill' : 'circle.dotted'
    const statusLabel = isFinished ? 'Finished' : 'Running'

    // A live surface renders a self-ticking native timer counting up from the
    // session's start — never a per-second push. `Text(timerInterval:)` needs a
    // real (non-zero) range to animate; `upper` matches the server's own 8h
    // Live Activity cap (ACTIVITY_MAX_LIFETIME_MS in tb-streamer) since the OS
    // ends the activity by then anyway.
    const startedAt = new Date(props.startedAt)
    const elapsed = { lower: startedAt, upper: new Date(props.startedAt + 8 * 60 * 60 * 1000) }

    return {
      banner: (
        <VStack alignment="leading" spacing={6} modifiers={[padding({ all: 14 })]}>
          <HStack spacing={8}>
            <Image
              assetName="ThreadbaseLogo"
              modifiers={[resizable(), frame({ width: 16, height: 16 }), clipShape('circle')]}
            />
            <Text
              modifiers={[
                font({ textStyle: 'headline' }),
                foregroundStyle({ type: 'hierarchical', style: 'primary' }),
                lineLimit(1),
              ]}
            >
              {props.projectName}
            </Text>
            <Spacer />
            {isFinished ? (
              <Image systemName={statusSymbol} size={20} color={statusColor} />
            ) : (
              <Text
                timerInterval={elapsed}
                countsDown={false}
                modifiers={[
                  font({ textStyle: 'headline', design: 'monospaced' }),
                  foregroundStyle(statusColor),
                ]}
              />
            )}
          </HStack>
          <Text
            modifiers={[font({ textStyle: 'caption' }), foregroundStyle(statusColor), lineLimit(1)]}
          >
            {statusLabel}
          </Text>
          <Text
            modifiers={[
              font({ textStyle: 'caption', design: 'monospaced' }),
              foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
              lineLimit(2),
              minimumScaleFactor(0.8),
            ]}
          >
            {props.lastOutput}
          </Text>
        </VStack>
      ),
      compactLeading: (
        <Image
          assetName="ThreadbaseLogo"
          modifiers={[resizable(), frame({ width: 20, height: 20 }), clipShape('circle')]}
        />
      ),
      compactTrailing: isFinished ? (
        <Image systemName={statusSymbol} size={16} color={statusColor} />
      ) : (
        <Text
          timerInterval={elapsed}
          countsDown={false}
          modifiers={[
            font({ textStyle: 'caption2', design: 'monospaced' }),
            foregroundStyle(statusColor),
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

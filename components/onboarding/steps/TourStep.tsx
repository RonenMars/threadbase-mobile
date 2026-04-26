import React, { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { PrimaryButton } from '../components/PrimaryButton'
import { colors, fonts } from '../theme'

interface Props {
  onDone: () => void
}

interface Concept {
  tag: string
  title: string
  body: string
  Preview: React.ComponentType
}

const CONCEPTS: Concept[] = [
  {
    tag: 'kanban',
    title: 'Sessions live on lanes.',
    body: 'Running, plan, waiting, done. Cards stream their state in real time.',
    Preview: KanbanPreview,
  },
  {
    tag: 'queue',
    title: 'Stack moves like commits.',
    body: 'Queue prompts in order. They fire one after the next, even while you sleep.',
    Preview: QueuePreview,
  },
  {
    tag: 'terminal',
    title: 'Streamed stdout, distilled.',
    body: 'Tool calls get inlined. Errors get a red lane. Plans get a blue lane.',
    Preview: TerminalPreview,
  },
]

export function TourStep({ onDone }: Props) {
  const [n, setN] = useState(0)
  const concept = CONCEPTS[n]
  const Preview = concept.Preview
  const isLast = n === CONCEPTS.length - 1

  return (
    <View style={styles.root}>
      <View style={styles.eyebrowRow}>
        <Text style={styles.eyebrow}>
          {'>'} 04 / TOUR · {String(n + 1).padStart(2, '0')}/
          {String(CONCEPTS.length).padStart(2, '0')}
        </Text>
        <Text style={styles.tag}>{concept.tag}</Text>
      </View>

      <Animated.View key={n} entering={FadeIn.duration(300)} style={styles.body}>
        <View style={styles.previewCard}>
          <Preview />
        </View>

        <Text style={styles.title}>{concept.title}</Text>
        <Text style={styles.bodyText}>{concept.body}</Text>
      </Animated.View>

      <View style={styles.progressRow}>
        {CONCEPTS.map((_, i) => (
          <View
            key={i}
            style={[
              styles.progressTrack,
              { backgroundColor: i <= n ? colors.blue400 : colors.ink5 },
            ]}
          />
        ))}
      </View>

      {isLast ? (
        <PrimaryButton onPress={onDone}>Drop me in</PrimaryButton>
      ) : (
        <PrimaryButton onPress={() => setN(n + 1)}>Next concept</PrimaryButton>
      )}
      <View style={{ height: 14 }} />
    </View>
  )
}

// ── Kanban preview ─────────────────────────────────────────────────────────
function KanbanPreview() {
  const lanes = [
    { l: 'running', c: colors.blue400, n: 2, live: true },
    { l: 'plan', c: colors.amber400, n: 2, live: false },
    { l: 'done', c: colors.fg2, n: 1, live: false },
  ] as const

  return (
    <View style={kanbanStyles.root}>
      {lanes.map((ln, i) => (
        <View key={i} style={kanbanStyles.lane}>
          <View style={kanbanStyles.laneHead}>
            <PulsingDot color={ln.c} live={ln.live} />
            <Text style={[kanbanStyles.laneLabel, { color: ln.c }]}>
              {ln.l.toUpperCase()}
            </Text>
          </View>
          {Array.from({ length: ln.n }).map((_, k) => (
            <View
              key={k}
              style={[kanbanStyles.card, { borderLeftColor: ln.c }]}
            >
              <View style={[kanbanStyles.skel, { width: '75%' }]} />
              <View
                style={[
                  kanbanStyles.skel,
                  { width: '45%', backgroundColor: colors.ink6, height: 3 },
                ]}
              />
              <Text style={kanbanStyles.branch}>⎇ feat/q-{k}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}

function PulsingDot({ color, live }: { color: string; live: boolean }) {
  const opacity = useSharedValue(live ? 0.55 : 1)

  useEffect(() => {
    if (!live) return
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.55, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    )
  }, [live, opacity])

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }))
  return <Animated.View style={[kanbanStyles.dot, { backgroundColor: color }, style]} />
}

const kanbanStyles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    padding: 12,
  },
  lane: { flex: 1, gap: 5 },
  laneHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
  },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  laneLabel: {
    fontFamily: fonts.mono,
    fontSize: 8.5,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  card: {
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 6,
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.ink5,
    borderLeftWidth: 2,
  },
  skel: {
    height: 4,
    backgroundColor: colors.ink5,
    borderRadius: 2,
    marginBottom: 3,
  },
  branch: {
    fontFamily: fonts.mono,
    fontSize: 7.5,
    color: colors.fg4,
    fontWeight: '500',
    marginTop: 2,
  },
})

// ── Queue preview ──────────────────────────────────────────────────────────
function QueuePreview() {
  const items = [
    { i: 'now', t: 'fix flaky test in auth.spec', c: colors.blue400, glow: true },
    { i: 'next', t: 'add rate limit middleware', c: colors.fg2, glow: false },
    { i: '+2', t: 'deploy preview to staging', c: colors.fg3, glow: false },
    { i: '+3', t: 'write changelog for v0.4', c: colors.fg4, glow: false },
  ] as const

  return (
    <View style={queueStyles.root}>
      <Text style={queueStyles.head}>↓ QUEUE · 4 PROMPTS</Text>
      {items.map((it, i) => (
        <View
          key={i}
          style={[
            queueStyles.row,
            {
              opacity: 1 - i * 0.12,
              borderLeftWidth: 2,
              borderLeftColor: it.glow ? it.c : 'transparent',
            },
          ]}
        >
          <Text style={[queueStyles.badge, { color: it.c }]}>
            {it.i.toUpperCase()}
          </Text>
          <Text style={queueStyles.task} numberOfLines={1}>
            {it.t}
          </Text>
        </View>
      ))}
    </View>
  )
}

const queueStyles = StyleSheet.create({
  root: { padding: 14, gap: 5 },
  head: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.fg3,
    fontWeight: '500',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.ink5,
  },
  badge: {
    fontFamily: fonts.mono,
    fontSize: 8.5,
    fontWeight: '600',
    width: 24,
    letterSpacing: 0.3,
  },
  task: {
    fontFamily: fonts.sans,
    fontSize: 10,
    color: colors.fg1,
    flex: 1,
  },
})

// ── Terminal preview ───────────────────────────────────────────────────────
function TerminalPreview() {
  const cursor = useSharedValue(1)
  useEffect(() => {
    cursor.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 0 }),
        withTiming(0, { duration: 500 }),
        withTiming(1, { duration: 500 }),
      ),
      -1,
      false,
    )
  }, [cursor])

  const cursorStyle = useAnimatedStyle(() => ({ opacity: cursor.value }))

  return (
    <View style={terminalStyles.root}>
      <Text style={terminalStyles.line}>
        <Text style={terminalStyles.idx}>[01] </Text>
        <Text style={{ color: colors.blue400 }}>$ </Text>
        <Text style={{ color: colors.fg2 }}>claude run feat/queue</Text>
      </Text>
      <Text style={terminalStyles.line}>
        <Text style={terminalStyles.idx}>[02] </Text>
        <Text style={{ color: colors.amber400 }}>● tool </Text>
        <Text style={{ color: colors.fg2 }}>Read src/queue/index.ts</Text>
      </Text>
      <Text style={terminalStyles.line}>
        <Text style={terminalStyles.idx}>[03] </Text>
        <Text style={{ color: colors.amber400 }}>● tool </Text>
        <Text style={{ color: colors.fg2 }}>Edit src/queue/index.ts </Text>
        <Text style={{ color: colors.green400 }}>+84/-12</Text>
      </Text>
      <Text style={terminalStyles.line}>
        <Text style={terminalStyles.idx}>[04] </Text>
        <Text style={{ color: colors.fg3 }}>→ </Text>
        <Text style={{ color: colors.fg2 }}>running tests…</Text>
      </Text>
      <Text style={terminalStyles.line}>
        <Text style={terminalStyles.idx}>[05] </Text>
        <Text style={{ color: colors.green400 }}>✓ 28 passed </Text>
        <Text style={{ color: colors.fg4 }}>· 0 failed · 1.4s</Text>
      </Text>
      <View style={terminalStyles.lastRow}>
        <Text style={terminalStyles.line}>
          <Text style={terminalStyles.idx}>[06] </Text>
          <Text style={{ color: colors.blue400 }}>plan </Text>
          <Text style={{ color: colors.fg2 }}>ready · </Text>
          <Text style={{ color: colors.fg0 }}>review on phone</Text>
        </Text>
        <Animated.View style={[terminalStyles.cursor, cursorStyle]} />
      </View>
    </View>
  )
}

const terminalStyles = StyleSheet.create({
  root: {
    flex: 1,
    padding: 14,
  },
  line: {
    fontFamily: fonts.mono,
    fontSize: 10,
    lineHeight: 16,
    color: colors.fg2,
    fontWeight: '500',
  },
  idx: { color: colors.fg3 },
  lastRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cursor: {
    width: 6,
    height: 11,
    backgroundColor: colors.fg0,
    marginLeft: 3,
  },
})

// ── Step shell styles ──────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 22, paddingTop: 4 },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  eyebrow: {
    color: colors.amber400,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  tag: {
    color: colors.fg3,
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '500',
  },
  body: { flex: 1 },
  previewCard: {
    height: 200,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: colors.ink0,
    borderWidth: 1,
    borderColor: colors.ink5,
  },
  title: {
    color: colors.fg0,
    fontFamily: fonts.sans,
    fontSize: 22,
    lineHeight: 25,
    fontWeight: '600',
    letterSpacing: -0.44,
    marginBottom: 8,
  },
  bodyText: {
    color: colors.fg2,
    fontFamily: fonts.sans,
    fontSize: 13.5,
    lineHeight: 20,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 14,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
})

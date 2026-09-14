import { View, Text, Pressable, StyleSheet } from 'react-native'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { MONO_FONT } from '@/constants/mono'
import { useTheme } from '@/contexts/ThemeContext'
import type { ProjectGroup } from './useProjectGroups'

interface Props {
  groups: ProjectGroup[]
  onPress: (group: ProjectGroup) => void
}

/**
 * The folded QUIET tier: one wrapped row of `name count` chips instead of a
 * card per long-tail project. A chip carries the same test id as its card, so
 * a flow that reaches for a project finds it folded or not.
 */
export function QuietProjectChips({ groups, onPress }: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)

  return (
    <View style={styles.wrap} testID="hub-quiet-chips">
      {groups.map((group) => {
        const count = group.sessions.length + group.conversationCount
        return (
          <Pressable
            key={`${group.serverId}::${group.projectId}`}
            onPress={() => onPress(group)}
            hitSlop={5}
            accessibilityRole="button"
            accessibilityLabel={`${group.projectName}, ${count}`}
            testID={`hub-project-${group.projectName}`}
            style={styles.chip}
          >
            <Text style={styles.name} numberOfLines={1}>{group.projectName}</Text>
            <Text style={styles.count}>{count}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs + 2,
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xs,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs + 1,
      minHeight: 34,
      paddingHorizontal: spacing.sm + 1,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bg.secondary,
    },
    name: {
      fontFamily: MONO_FONT,
      fontSize: font.xs,
      color: theme.text.secondary,
      maxWidth: 160,
    },
    count: {
      fontFamily: MONO_FONT,
      fontSize: font.xs,
      color: theme.text.secondary,
      opacity: 0.7,
      fontVariant: ['tabular-nums'],
    },
  })
}

# RTL (Right-to-Left) Support

The app supports RTL languages (Arabic, Hebrew, etc.) through React Native's built-in `I18nManager` and custom RTL utilities.

## How RTL Works

1. **Automatic detection**: `lib/i18n.ts` detects device locale and text direction via `expo-localization`
2. **Global RTL mode**: `I18nManager.forceRTL(isRTL)` flips the entire app layout on launch
3. **Component-level awareness**: Components use `lib/rtl.ts` utilities for explicit RTL handling

## RTL Utilities (`lib/rtl.ts`)

Import from `@/lib/rtl`:

```typescript
import { flexRow, flexRowReverse, isRTL } from '@/lib/rtl'
```

### Functions

- **`flexRow()`** — Returns `'row'` in LTR, `'row-reverse'` in RTL. Use for horizontal layouts that should flip.
- **`flexRowReverse()`** — Returns the opposite. Use when you want to override natural RTL behavior.
- **`directionStart()`** — Returns `'Left'` in LTR, `'Right'` in RTL. For margin/padding properties.
- **`directionEnd()`** — Returns `'Right'` in LTR, `'Left'` in RTL.
- **`rtlMultiplier()`** — Returns `1` in LTR, `-1` in RTL. For transform operations.
- **`isRTL`** — Boolean indicating current RTL state.

### Style Constants

```typescript
import { styles } from '@/lib/rtl'

// Use in StyleSheet.create:
container: {
  ...styles.flexRow,  // flexDirection: 'row' (LTR) or 'row-reverse' (RTL)
}
```

## When to Apply RTL

### Always flip:
- Navigation headers with back buttons
- List items with icons on the left/right
- Horizontal button groups
- Text alignment in headers/titles
- Chevron/arrow icons

### Never flip:
- Numeric content (phone numbers, dates in some formats)
- Code blocks and terminal output
- Media controls (play/pause)
- Brand logos

### Conditional:
- Forms: text fields usually flip, but number inputs may not
- Maps and diagrams: depends on context

## Adding RTL to Components

### Before (LTR-only):

```typescript
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: 16,
  }
})
```

### After (RTL-aware):

```typescript
import { flexRow } from '@/lib/rtl'

const styles = StyleSheet.create({
  header: {
    flexDirection: flexRow(),
    justifyContent: 'space-between',
    paddingStart: 16,  // Use paddingStart/End instead of Left/Right
  }
})
```

Or for dynamic styles:

```typescript
import { directionStart } from '@/lib/rtl'

const dynamicStyle = {
  [`margin${directionStart()}`]: 16  // marginLeft in LTR, marginRight in RTL
}
```

## Testing RTL

### iOS Simulator:
1. Settings → General → Language & Region
2. Select Arabic (or Hebrew)
3. Restart the app

### Android Emulator:
1. Settings → System → Languages → Add Arabic
2. Set as primary language
3. Developer options → Force RTL layout direction → ON

### Expo Dev Client:
```bash
# Force RTL for testing (add to .env.local):
EXPO_RTL=true
```

## Translation Files

Arabic translations are in `locales/ar/`. Structure mirrors `locales/en/`:

- `common.json` — buttons, errors, common UI
- `sessions.json` — session-related strings
- `terminal.json` — terminal/conversation UI
- `settings.json` — settings screen
- `servers.json` — server management
- `onboarding.json` — onboarding flow
- `conversation.json`, `browse.json`, `queue.json`, `pair.json`, `shared.json`

To add a new language:
1. Create `locales/<lang-code>/` directory
2. Copy all JSON files from `locales/en/`
3. Translate strings (keep interpolation variables like `{{count}}`)
4. Import in `lib/i18n.ts` and add to `resources` object

## Common Pitfalls

1. **Hardcoded margins**: Use `paddingStart`/`paddingEnd` instead of `Left`/`Right`
2. **Absolute positioning**: `left: 0` should be `start: 0` (requires `StyleSheet.absoluteFillObject` workaround)
3. **Text alignment**: `textAlign: 'left'` should be `textAlign: 'auto'` or use i18n-aware logic
4. **Icons**: Chevrons and arrows should flip via `transform: [{ scaleX: rtlMultiplier() }]`

## Resources

- [React Native RTL Guide](https://reactnative.dev/docs/rtl)
- [i18next Documentation](https://www.i18next.com/)
- [Expo Localization](https://docs.expo.dev/versions/latest/sdk/localization/)

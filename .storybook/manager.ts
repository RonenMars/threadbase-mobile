import { addons } from 'storybook/manager-api'
import { create } from 'storybook/theming'
import { dark } from '../constants/theme'

addons.setConfig({
  theme: create({
    base: 'dark',
    brandTitle: 'Threadbase',
    appBg: dark.bg.primary,
    appContentBg: dark.bg.secondary,
    appBorderColor: dark.border,
    textColor: dark.text.primary,
    textMutedColor: dark.text.secondary,
    barBg: dark.bg.secondary,
    barTextColor: dark.text.secondary,
    barSelectedColor: dark.text.accent,
    colorPrimary: dark.text.accent,
    colorSecondary: dark.text.accent,
    inputBg: dark.bg.card,
    inputBorder: dark.border,
    inputTextColor: dark.text.primary,
  }),
})

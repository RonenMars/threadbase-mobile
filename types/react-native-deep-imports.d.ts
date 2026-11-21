// react-native's package exports give Libraries/* no types; these two are the public components.
declare module 'react-native/Libraries/Text/Text' {
  const Text: typeof import('react-native').Text
  export default Text
}

declare module 'react-native/Libraries/Components/TextInput/TextInput' {
  const TextInput: typeof import('react-native').TextInput
  export default TextInput
}

// Not in phosphor-react-native's exports; the file every icon renders through.
declare module 'phosphor-react-native/lib/module/lib/icon-base' {
  import type { ComponentType, FC, ReactElement } from 'react'
  import type { IconProps, IconWeight } from 'phosphor-react-native'
  const IconBase: ComponentType<
    IconProps & {
      name: string
      weights: Map<IconWeight, ReactElement | FC<{ duotoneColor?: string; duotoneOpacity?: number }>>
    }
  >
  export default IconBase
}

// react-native's package exports give Libraries/* no types; these two are the public components.
declare module 'react-native/Libraries/Text/Text' {
  const Text: typeof import('react-native').Text
  export default Text
}

declare module 'react-native/Libraries/Components/TextInput/TextInput' {
  const TextInput: typeof import('react-native').TextInput
  export default TextInput
}

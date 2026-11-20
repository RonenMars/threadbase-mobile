// Jest stub for @expensify/react-native-live-markdown's MarkdownTextInput.
// The real one requires a babel-transformed worklet parser and a native
// decorator view; under Jest it is the TextInput it wraps. `parser` is kept
// on the host so a test can tell which one the composer passed.
const React = require('react')
const { TextInput } = require('react-native')

module.exports = React.forwardRef(function MarkdownTextInput({ markdownStyle, ...props }, ref) {
  return React.createElement(TextInput, { ...props, ref })
})

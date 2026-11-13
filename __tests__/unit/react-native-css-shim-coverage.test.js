const fs = require('fs')
const path = require('path')

// react-native-css resolves every `react-native` import in the bundle to its
// own fixed list of getters. A name react-native exports but the shim lacks
// reads as undefined in a release build, so expo-modules-core 58 crashed at
// startup on `NativeComponentRegistry.get`. Metro picks one of these three
// files depending on resolver conditions, so all three must keep up.
const root = path.join(__dirname, '..', '..', 'node_modules')
const getters = (file) =>
  new Set([...fs.readFileSync(path.join(root, file), 'utf8').matchAll(/^ {2}get (\w+)\(\)/gm)].map((m) => m[1]))

const reactNativeExports = getters('react-native/index.js')

describe.each([
  'react-native-css/src/components/index.cts',
  'react-native-css/dist/commonjs/components/index.cjs',
  'react-native-css/dist/module/components/index.cjs',
])('%s', (shim) => {
  it('re-exports every name react-native exports', () => {
    const shimExports = getters(shim)
    expect([...reactNativeExports].filter((name) => !shimExports.has(name))).toEqual([])
  })
})

module.exports = {
  // react-native-svg@15.12.1 ships a react-native.config.js that only declares
  // dependency.platforms.android, which @react-native-community/cli 14+ reads
  // as platforms.ios = null and skips iOS autolinking. Codegen still emits
  // RNSVG* Fabric components into RCTThirdPartyComponentsProvider, so
  // NSClassFromString(@"RNSVGCircle") returns nil at launch and the
  // dictionary literal aborts. Force iOS autolinking back on.
  dependencies: {
    'react-native-svg': {
      platforms: { ios: {} },
    },
  },
};

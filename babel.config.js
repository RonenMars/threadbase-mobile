module.exports = function (api) {
  const isTest = api.env('test')
  api.cache.using(() => isTest)
  return {
    presets: ['babel-preset-expo'],
    plugins: isTest ? [] : ['react-native-worklets/plugin'],
  }
}

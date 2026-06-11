// Manual mock for @react-native-async-storage/async-storage
// Used by jest moduleNameMapper to intercept both static and dynamic imports.
const AsyncStorage = {
  setItem: jest.fn().mockResolvedValue(undefined),
  getItem: jest.fn().mockResolvedValue(null),
  removeItem: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
  getAllKeys: jest.fn().mockResolvedValue([]),
  multiGet: jest.fn().mockResolvedValue([]),
  multiSet: jest.fn().mockResolvedValue(undefined),
};

module.exports = AsyncStorage;
module.exports.default = AsyncStorage;

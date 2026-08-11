const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const globals = require("globals");
const i18next = require("eslint-plugin-i18next");
const reactNative = require("eslint-plugin-react-native");

module.exports = defineConfig([
  {
    // .worktrees/** — a worktree checked out under the repo root is a second
    // copy of the tree; linting it reports findings from another branch and
    // crashes import/namespace when its node_modules differs from ours.
    ignores: [".expo/**", ".remember/**", ".worktrees/**"],
  },
  ...expoConfig,
  {
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
    plugins: {
      i18next,
      "react-native": reactNative,
    },
    rules: {
      "import/no-duplicates": "off",
      "import/no-named-as-default-member": "off",
      // AST-based i18n enforcement - prioritizes layout files
      "i18next/no-literal-string": [
        "error",
        {
          markupOnly: true,
          // AST parser checks these props across React Native components
          attributes: {
            Button: ["title"],
            TextInput: ["placeholder", "label"],
            Header: ["title", "subtitle"],
            AppBar: ["title", "subtitle"],
            TouchableOpacity: [], // No text props by default
            TouchableHighlight: [],
            View: [],
            // Global wildcard - applies to all components
            "*": ["accessibilityLabel", "accessibilityHint"],
          },
          // Ignore technical/layout string values (not user-facing text)
          ignoreAttribute: [
            "testID",
            "accessibilityRole",
            "style",
            "className",
            "color",
            "size",
            "weight",
            "name",
            "type",
            "key",
            "id",
            "source",
            "flex",
            "flexDirection",
            "justifyContent",
            "alignItems",
            "position",
            "display",
            "direction",
            "textAlign",
            "fontWeight",
            "fontSize",
            "lineHeight",
            "resizeMode",
            "contentFit",
            "iconName", // Phosphor icon names
            "icon",
            "variant",
            "theme",
            "mode",
          ],
          ignoreCallee: [
            "require",
            "console.log",
            "console.warn",
            "console.error",
            "console.info",
            "console.debug",
            "clsx",
            "StyleSheet.create",
            "Animated.timing",
          ],
          ignoredFiles: [
            "**/*.test.{ts,tsx}",
            "__tests__/**/*.{ts,tsx}",
            "test-utils/**/*.{ts,tsx}",
          ],
        },
      ],
      // Catch raw text children in <Text> nodes
      "react-native/no-raw-text": [
        "error",
        {
          skip: ["CustomText"], // If you have custom text wrappers
        },
      ],
    },
  },
  {
    files: ["**/*.test.{js,ts,tsx}", "**/__mocks__/**/*.{js,ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
  {
    files: [
      "__tests__/**/*.{ts,tsx}",
      "**/*.test.{ts,tsx}",
      "test-utils/**/*.{ts,tsx}",
    ],
    rules: {
      "i18next/no-literal-string": "off",
      "react-native/no-raw-text": "off",
      "@typescript-eslint/no-require-imports": "off",
      "react/display-name": "off",
    },
  },
  // Script tests drive real git repos under Node — allow Node built-ins.
  {
    files: ["__tests__/unit/scripts/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  // e2e mock servers run under Node — allow Node built-ins.
  {
    files: ["e2e/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
        // Maestro runScript sandbox globals
        http: "readonly",
        output: "writable",
      },
    },
  },
]);

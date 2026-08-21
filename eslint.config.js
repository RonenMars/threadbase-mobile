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
      // (v6.1.5 schema — see eslint-plugin-i18next/lib/options/defaults.js;
      // v5 option names like markupOnly/attributes/ignoreAttribute are silently ignored)
      "i18next/no-literal-string": ["error", {
        mode: "all",
        "jsx-attributes": { include: ["accessibilityLabel","accessibilityHint","placeholder","title","label","subtitle","description","message","cta","buttonText","confirmText","cancelText","emptyText"] },
        callees: { include: ["Alert.alert","Alert.prompt","toast","showToast","notify"] },
        "object-properties": { include: ["text","title","message","label","body","subtitle","description","hint","placeholder","cta","buttonText"] },
        words: { exclude: [
          "^[^a-zA-Z]*$",
          "^[a-z0-9_:/@-]+$",
          "^[A-Z0-9_]+$",
          "^[a-z][A-Za-z0-9]*(\\.[A-Za-z][A-Za-z0-9]*)+$",
          "^#[0-9a-fA-F]{3,8}$",
          // mode: "all" checks every Literal node, including the 'use strict' directive prologue
          "^use strict$"
        ] },
      }],
      // Catch raw text children in <Text> nodes
      "react-native/no-raw-text": [
        "error",
        {
          skip: ["CustomText"], // If you have custom text wrappers
        },
      ],
    },
  },
  // These emit developer/diagnostic text (trace labels, sanitizer markers,
  // log messages), not user-facing copy, so i18n literal-string checks don't apply.
  {
    files: [
      "lib/openTrace.ts",
      "services/diagnostics.ts",
      "services/sanitize.ts",
      "services/server-diagnostics.ts",
      "lib/conversationHref.ts",
      "lib/rtl.ts",
    ],
    rules: {
      "i18next/no-literal-string": "off",
    },
  },
  // design/ is reference material (mockups, UI kits, scratch) imported by nothing
  // under app/ or components/, and demo/ is a standalone demo server — neither
  // ships in the app, so their strings aren't user-facing copy to translate.
  {
    files: ["design/**/*.{js,jsx,ts,tsx}", "demo/**/*.{js,jsx,ts,tsx}"],
    rules: {
      "i18next/no-literal-string": "off",
    },
  },
  // Internal identifiers, not copy: a TypeScript type-only import path
  // (types.ts), wire-format sort keys (useSession.ts), a base64 alphabet
  // constant (sentry.ts), and an http→ws URL scheme rewrite (ws-client.ts).
  // None of these strings are ever rendered to a user.
  {
    files: [
      "components/sessions/hub/types.ts",
      "hooks/useSession.ts",
      "services/sentry.ts",
      "services/ws-client.ts",
    ],
    rules: {
      "i18next/no-literal-string": "off",
    },
  },
  // Both files build an Error subclass's `message` field, but the UI never
  // reads it: a pairing failure's display text is picked by err.kind via
  // resolvePairFailureMessage() (services/pair-failure-message.ts), and a
  // restore conflict's message is set aside — app/backup-restore.tsx shows
  // t('backup.conflict') instead. The literals here are dead for display.
  {
    files: ["services/pair-exchange.ts", "types/backup.ts"],
    rules: {
      "i18next/no-literal-string": "off",
    },
  },
  // Build/codemod tooling run under Node, never shipped as app code — its
  // strings (file paths, log output) aren't user-facing copy.
  {
    files: ["scripts/**/*.{js,ts}"],
    rules: {
      "i18next/no-literal-string": "off",
    },
  },
  // RTL: physical insets do not mirror. I18nManager flips marginStart/End and
  // paddingStart/End under an RTL locale but leaves Left/Right anchored, so a
  // physical inset stays on the wrong side in Hebrew and Arabic (#822).
  //
  // textAlign has no logical value in React Native — only auto/left/right/
  // center/justify — so it is deliberately not restricted here. 'auto'
  // resolves to left in LTR, which would misalign the numeric columns that
  // legitimately use 'right'. Direction-aware text needs I18nManager.isRTL.
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    rules: {
      // Deliberately `warn`, not `error`: 14 sites remain and they are not all
      // mechanical. LanguageStep's `optionLabelRtl` is an explicitly RTL-only
      // style, and the symmetric borderLeft+borderRight pairs in the slash-
      // command surfaces mirror to a no-op. Each needs a per-site decision,
      // the way the i18n rule was burned down before it became an error.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Property[key.name=/^(marginLeft|marginRight|paddingLeft|paddingRight|borderLeftWidth|borderRightWidth|borderLeftColor|borderRightColor)$/]",
          message:
            "Physical insets do not mirror under RTL. Use marginStart/marginEnd, paddingStart/paddingEnd or borderStartWidth/borderEndWidth.",
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
      "__tests__/**/*.{js,ts,tsx}",
      "**/*.test.{js,ts,tsx}",
      "test-utils/**/*.{js,ts,tsx}",
    ],
    rules: {
      "i18next/no-literal-string": "off",
      "react-native/no-raw-text": "off",
      "@typescript-eslint/no-require-imports": "off",
      "react/display-name": "off",
    },
  },
  {
    files: ["**/*.stories.tsx", ".storybook/**/*.{ts,tsx}"],
    rules: {
      "i18next/no-literal-string": "off",
      "react-native/no-raw-text": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Plain-JS unit tests read files off disk under Node — allow Node built-ins.
  {
    files: ["__tests__/unit/**/*.js"],
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

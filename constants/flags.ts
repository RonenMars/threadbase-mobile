// Enable interactive question cards in the chat (both structured WS flow and PTY-scrape).
// Off by default; set EXPO_PUBLIC_FEATURE_QUESTIONS=true to enable:
//   EXPO_PUBLIC_FEATURE_QUESTIONS=true npx expo start
export const FEATURE_QUESTIONS =
  process.env.EXPO_PUBLIC_FEATURE_QUESTIONS === 'true'

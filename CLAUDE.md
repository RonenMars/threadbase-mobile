# Threadbase Mobile — Claude Instructions

## Shipping / Release Pipeline

**Default ship tool: `/expo-local-ship`**

Always use `/expo-local-ship` when the user says "ship", "TestFlight", "build the app", "submit", or anything release-related.

**`/ship-expo-cloud` (EAS cloud builds) is opt-in only:**
- Only invoke it when the user explicitly types `/ship-expo-cloud`
- Before running any EAS build or submit command, stop and ask the user to confirm — do not proceed automatically
- Never trigger it as a side-effect of a "ship" or "commit and ship" request

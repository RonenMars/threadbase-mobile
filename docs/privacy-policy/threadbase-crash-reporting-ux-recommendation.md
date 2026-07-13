# Threadbase Crash Reporting UX Recommendation

## Recommendation

Remove the crash-reporting checkbox from onboarding.

The better fit for Threadbase is to defer the decision until the first crash, when the user understands why crash reporting is useful and can make a more informed choice.

## Why not ask during onboarding

During onboarding, the user:

- has not used the app yet;
- has not experienced a crash;
- has little context for what a crash report contains;
- is more likely to ignore the option or accept it just to finish onboarding.

That makes the decision less meaningful and adds friction to a screen that should stay focused on getting the user into the app.

## Recommended flow

### 1. Onboarding

Do not ask for crash-report consent.

Keep onboarding focused on setup and first use.

### 2. First crash

Show a recovery screen that explains what will and will not be included.

Suggested structure:

```text
Threadbase crashed.

This report includes:
- error message
- stack trace
- app version
- device model
- operating-system version

This report does not intentionally include:
- conversations
- prompts
- terminal output
- credentials
- server addresses
```

Suggested actions:

```text
Report this crash
Always send sanitized crash reports
Don't send
```

### 3. After a one-time report

After the user successfully sends a single crash report, optionally ask once:

```text
Thanks for helping improve Threadbase.

Would you like to automatically send sanitized crash reports in the future?

Enable
Not now
```

This is a natural moment to ask because the user has already chosen to help once and understands the purpose.

### 4. Settings

Keep a persistent setting under Privacy or Crash Reporting:

```text
Automatically send sanitized crash reports
```

Suggested supporting text:

```text
Help improve Threadbase by automatically sending technical crash reports.

Reports may include app, device, operating-system, and error details. They do not intentionally include conversations, prompts, terminal output, credentials, or server addresses.
```

## Recommended wording changes

Avoid:

- `anonymous crash reports`
- `No personal data is ever sent`
- `Reports never contain...`

Prefer:

- `sanitized crash reports`
- `pseudonymous app-specific identifier`
- `does not intentionally include...`
- `is designed to exclude...`

This wording is more accurate because technical metadata such as device model, operating-system version, and a persistent installation identifier may still be processed.

## Exception for early beta testing

If Threadbase is still in a very early alpha or beta phase with a small group of testers, an onboarding checkbox can be justified because crash reports are especially valuable.

If you keep it during beta, use wording such as:

```text
Help improve Threadbase by automatically sending sanitized crash reports.

Reports may include technical information such as the app version, operating system, device model, and error details. They do not intentionally include conversations, prompts, credentials, or terminal output.

You can change this anytime in Settings.
```

For the public release, the preferred design is still to remove the onboarding checkbox and ask only when a crash actually occurs.

## Final recommendation

For Threadbase's local-first and privacy-focused positioning:

1. No crash-report checkbox during onboarding.
2. Ask only after the first crash.
3. Allow one-time reporting without enabling automatic reporting.
4. Offer automatic reporting only as a separate opt-in.
5. Keep the setting reversible in Settings.
6. Show a concise summary of included and excluded data before sending.

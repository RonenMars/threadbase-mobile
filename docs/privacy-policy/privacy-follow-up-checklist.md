# Threadbase Privacy Policy -- Follow-up Checklist

## High priority

-   Verify Sentry SDK configuration.
-   Confirm `sendDefaultPii = false`.
-   Verify server-side IP scrubbing.
-   Audit `beforeSend` sanitization.
-   Verify Session Replay, Profiling, Performance Monitoring, and
    Tracing are disabled.
-   Verify breadcrumbs (console, HTTP, navigation) are appropriate.

## Crash reporting

-   Verify exactly which fields are sent for:
    -   JS exception
    -   Native iOS crash
    -   Native Android crash
    -   Manual crash report
-   Confirm installation identifier lifecycle.
-   Verify opt-in/opt-out behavior.

## Feedback

-   Finalize feedback transport architecture.
-   Document retention period.
-   Document attachment handling.

## Push notifications

-   Audit notification payload.
-   Ensure payload excludes prompts, terminal output, credentials,
    repository information, and conversation content.

## Privacy & Legal

-   Replace Sentry region placeholder.
-   Add controller/entity information if applicable.
-   Review GDPR/UK GDPR wording.
-   Add international transfer wording matching production.
-   Review deletion request flow.

## Speech recognition

-   Verify on-device behavior on iOS and Android.
-   Adjust wording if cloud processing is possible.

## Store compliance

-   Update Apple App Privacy labels.
-   Update Google Play Data Safety form.
-   Verify third-party SDK disclosures.

## Final QA

-   Compare policy against production implementation.
-   Inspect raw Sentry events before release.
-   Review policy after every SDK upgrade.

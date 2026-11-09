# Recovering a partially successful store deployment

The manual [Deploy workflow](../workflows/deploy.yml) supports independent iOS and Android releases. A `platform: all` deployment runs **iOS first**; Android starts only if the iOS job succeeds. Uploads to App Store Connect and Google Play are external operations: GitHub cannot roll them back if a later step fails.

## If iOS succeeded and Android failed

1. Open the original GitHub Actions run and verify **Ship iOS** completed successfully. Inspect **Ship Android** to determine whether its **Ship Android** upload step actually succeeded. A failed *post-upload* version-bump or tagging step is not evidence that the store upload failed.
2. Check App Store Connect and Google Play Console for the uploaded build and release state. In particular, verify the Android version code before retrying; do not assume a failed GitHub job means Google Play did not receive the artifact.
3. If Android still needs deployment, manually dispatch **Deploy** with:
   - `platform: android`
   - `deploy_ref:` the **exact commit SHA** from the original release (or its immutable release tag). Do not use a moving branch name unless you intentionally want newer code.
   - `android_track:` the originally intended Play track.
   - `production_confirmation: PRODUCTION` **only** when the track is `production`.
4. Inspect the new Android-only run. It will skip iOS, run Android's Play version-code validation, and then upload. Verify the resulting version code in Play Console.
5. If Android had already uploaded successfully but the workflow failed during its version-bump PR or release-tag step, **do not blindly redeploy**. First reconcile `app.json` / the Android Gradle version code on `main` with the store, and inspect the existing bump PR and GitHub Release. A rerun can create an unnecessary new build.

## If iOS failed

- Check whether the IPA was actually uploaded to App Store Connect before the failure (for example, a post-upload polling timeout).
- If it was uploaded, confirm its processing state and the iOS build number before triggering a new deployment.
- If Android was skipped in an `all` run, the Android-only recovery procedure above is available **after** the iOS outcome is understood.
- For an iOS-only retry, choose `platform: ios` and the original commit SHA; confirm the target (`testflight` or `production`) and supply `production_confirmation: PRODUCTION` for production.

## Safety notes

- Do not select `platform: all` merely to retry Android; it will build and upload iOS again.
- The workflow's iOS build-number and Android version-code checks query their respective stores, but they do not make an upload transaction atomic or guarantee that a rerun is idempotent.
- When the original deployment used `deploy_ref: main`, use its **resolved commit SHA** for an exact-source recovery. Version metadata may still be updated by the release scripts.
- Workflow-level concurrency serializes running releases but does not provide a durable FIFO queue; check pending runs before dispatching multiple releases.
- Production confirmation is an accidental-release safeguard, not a substitute for repository access controls or environment approvals.

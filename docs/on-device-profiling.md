# Profiling the app on a physical device

Written after the 2026-09-22/23 investigation into idle CPU burn, which ended in [#1173](https://github.com/RonenMars/threadbase-mobile/pull/1173).
It is half method and half case study: the method is reusable, and the case study is here because almost every wrong turn in it was a *measurement* that looked right.

The companion document for the opposite kind of question — "why is this one action slow" rather than "why is nothing happening expensive" — is [`conversation-open-profile.md`](./conversation-open-profile.md).
It opens with a section admitting every number in its previous version was invalid. That is not a coincidence; see [Obstacles](#obstacles-every-one-of-these-produced-a-plausible-wrong-number) below.

## When to reach for this

Use a device Time Profiler trace when the question is **where CPU time goes**, and specifically when:

- the cost is continuous rather than triggered by an action, so there is nothing to time with a stopwatch or a `performance.now()` probe;
- you suspect native or framework work rather than your own JS, because a JS-side probe cannot see it;
- the symptom is battery, heat, or fan noise, which are all "percent of a core over minutes", not milliseconds.

Do **not** reach for it first when the question is "why did this screen take 2 seconds to appear". A targeted `EXPO_PUBLIC_*` trace probe answers that faster and more legibly — see `lib/openTrace.ts` and the [troubleshooting](./troubleshooting.md) entry on measuring the wrong thing.

## The harness

`xctrace` (the Instruments CLI) records and exports without opening the Instruments UI, which matters because the UI cannot be driven from a script and its summaries cannot be diffed between runs.

```bash
#!/bin/bash
# usage: profile.sh <label> [seconds] — records a Time Profiler trace of Threadbase on the phone
set -euo pipefail
LABEL="$1"; SECS="${2:-60}"
DEV=<hardware-udid>                 # xcrun xctrace list devices
DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="${DIR}/${LABEL}.trace"
rm -rf "${OUT}"
# Instruments loses a wired device until CoreDevice is poked; this brings it back online.
xcrun devicectl device info details --device <devicectl-identifier> >/dev/null 2>&1 || true
xcrun xctrace record --template 'Time Profiler' --device "${DEV}" --attach Threadbase \
  --time-limit "${SECS}s" --output "${OUT}" >/dev/null
xcrun xctrace export --input "${OUT}" \
  --xpath '/trace-toc/run[@number="1"]/data/table[@schema="time-profile"]' > "${DIR}/${LABEL}.xml"
python3 "${DIR}/summarize.py" "${DIR}/${LABEL}.xml" "${SECS}"
```

`--attach Threadbase` profiles the already-running app, so the measurement is of the app in the state you put it in, not of a cold launch.
`--time-limit` means the command returns on its own; there is no "stop recording" step to get wrong.

### Reading the export

The exported XML is a flat list of samples, each with a thread, a weight in **nanoseconds**, and a backtrace.
Two properties make it awkward and are worth knowing before writing any analysis:

- **It is heavily ref-deduplicated.** Any element can be a `ref` pointing at an earlier element carrying the real value, so every read needs to resolve through an id table first. Skip this and thread names and weights come back empty for most rows, which reads as "the app was idle" rather than as a parsing bug.
- **Backtraces are nested under a `tagged-backtrace` wrapper**, not direct children of the row.

The summariser that handled both, and the shape of question worth asking of a trace:

```python
WATCH = {
    "reanimated frame loop":     re.compile(r"AnimationFrameQueue|AnimationFrameBatchinator"),
    "reanimated commitUpdates":  re.compile(r"commitUpdates|performOperations"),
    "hermes (any thread)":       re.compile(r"hermes::vm::(Interpreter|Runtime)"),
    "shadow-tree commit":        re.compile(r"ShadowTree::(commit|tryCommit)"),
}
```

Percent of one core over the wall-clock window is the unit that survives comparison between runs.
Absolute milliseconds do not, because runs of different lengths are not comparable and a 45 s run and a 60 s run were both used here.

**Name the stacks you care about up front and print them for every run.** A ranked list of leaf frames looks more informative and is far worse for comparing scenarios: the ranking reshuffles between runs and invites you to explain noise. A fixed set of watched patterns produces a table with stable columns, which is what actually decides anything.

## The case study

The question was "the app is hot and the battery drains while it sits there". The suspicion, from the person holding the phone, was the chat shelf bubble.

Each row is one 45–60 s recording with the phone untouched, same screen, same data.

| Run | Condition | Reanimated frame loop (JS) | Per-frame commit | Main thread |
|---|---|---|---|---|
| A | shelf bubble + badge pulsing | 28.6% | 27.2% | 37.2% |
| B | shelf bubble, no badge | 35.0% | 33.1% | 45.3% |
| C | no shelf at all | 30.4% | 28.8% | 41.9% |
| D | another screen | 31.8% | 30.3% | 42.7% |
| E | Reduce Motion on | 0.3% | 0.0% | **2.5%** |
| F | Reanimated 4 CSS animations | 0.3% | 37.6% | 49.2% |
| ~~G~~ | *invalid — stale bundle* | — | — | — |
| H | RN native driver | 0.5% | **0.0%** | **9.1%** |

Every frame, at 120 Hz on ProMotion, ran:

```
CADisplayLink
  → -[AnimationFrameQueue executeQueueForProMotion:]
    → worklets::AnimationFrameBatchinator::flush → WorkletRuntime::runSync → Hermes
      → reanimated::ReanimatedModuleProxy::commitUpdates
        → ShadowTree::commit / tryCommit → ShadowTree::mount
          → YogaLayoutableShadowNode::layoutTree
```

## Conclusions

**A running Reanimated animation on Fabric commits the whole surface's shadow tree, once per display frame, and re-runs Yoga with it.** Whatever prop it animates. The cost therefore scales with the size of the tree, not with the number or the size of the animations — which is why a 7 px pulsing dot and a full-screen transition cost the same, and why a list with more rows on screen is more expensive to *leave alone*.

**Reduce Motion is the measurement that turns a guess into a bound.** It cancels every animation the app runs, so run E is not a scenario, it is the floor: it says the entire remaining cost of the idle app is 2.5%, and therefore that 35–43 points of the observed cost belong to animations and nothing else. Reaching for it early would have skipped runs A–D entirely. **On any "something is continuously expensive" question, find the switch that turns the whole suspected subsystem off and measure that first.** It converts an open-ended hunt into a subtraction.

**Reanimated 4's CSS animations do not solve this, and they look like they should.** They move the animation off the JS thread entirely — the frame loop fell 31.8% → 0.3%, which is exactly the improvement the feature advertises. The per-frame commit stayed at 37.6%, and the main thread got *worse*. They were implemented, measured, and reverted. Do not re-try this.

**React Native's own `Animated` with `useNativeDriver: true` is the fix**, and it is older and less fashionable than what it replaced. It serialises the animation to native once at `start()` and then writes `opacity`/`transform` straight onto the view, never entering the shadow tree. `CA::Layer` work appears in the trace where `REANodesManager performOperations` used to be. 42.7% → 9.1%.

The constraint that comes with it: **the native driver only animates properties that do not affect layout.** `opacity` and `transform`, not `left`/`width`/`top`/colours — because those need a layout pass, which is the thing being avoided. A sweep bar animating a percentage `left` had to become a `translateX`. If a conversion "can't use the native driver", the property is usually the reason, and changing the property is usually possible.

**The suspicion was wrong, and cheaply disproved.** Run C — no shelf at all — matched runs A and B. Two runs settled it. It is worth measuring the named suspect early even when you doubt it, because ruling it out costs one recording and leaving it open costs every subsequent conversation.

## Obstacles: every one of these produced a plausible wrong number

This is the part worth reading twice. None of these failed loudly.

The general form of all of them is already written down, from a different investigation: [`troubleshooting.md`](./troubleshooting.md) → "A repeated `simctl openurl` loop measures a screen stack you built, not the app" ends with the rule that **an unattended harness is code, and code nobody tested measures whatever it happens to do**. Everything below is that rule collecting four more instances.

One of them is already in that document under its own heading — "The dev client keeps serving a stale, disk-cached bundle" — and it was walked into anyway, which is its own lesson about when a catalogue gets read. The genuinely new entries are the **profiler losing the device connection** and the **test-environment cost of the fix**.

That document also has "The profiler is recording the debugger UI, not the app", about Chrome DevTools. `xctrace --attach` is not exposed to that particular mistake, which is a reason to prefer it.

**The device disappears from Instruments.** `xctrace record` fails with "Timed out waiting for device to boot" or "still offline" while `devicectl` reports the same phone wired, unlocked and booted. Killing `CoreDeviceService` and `remotepairingd` does not help. Running `xcrun devicectl device info details --device <id>` does — it wakes CoreDevice and the phone reappears in `xctrace list devices`. Note the two IDs are different: `xctrace` wants the hardware UDID (`00008150-…`), `devicectl` wants its own identifier. The poke is in the script above so it self-heals.

**The dev client serves a disk-cached bundle, silently** — [already catalogued](./troubleshooting.md#the-dev-client-keeps-serving-a-stale-disk-cached-bundle), and hit regardless. Run G measured the same JS as run F — its numbers matched to a tenth of a percent — because a force-quit and reopen served the cached bundle rather than fetching the new one. There is no error, no warning, and the app looks freshly launched. It was caught only because deliberate `console.log` instrumentation printed nothing in Metro's output. **A measurement of a code change is worthless until you have independent evidence the device is running that code.** A dev-menu *Reload* does fetch fresh; a force-quit may not. Run G is left in the table as a row rather than deleted, because a deleted invalid run teaches nothing.

**A different screen is not an isolation test.** Run D was read, briefly, as "the cost follows the app, not the screen" — true — and nearly as "so the visible screen doesn't matter", which is false. Native-stack navigation does not unmount the screen you pushed *from*: the Hub was still mounted and still animating underneath Settings. To isolate a screen you must unmount it, and pushing over it does not.

**Test-environment behaviour can differ from device behaviour in the direction that matters.** The conversion landed green locally and went red on CI, deterministically, on a test that had nothing to do with animation. `react-native-reanimated` is mocked to a no-op in jest; React Native's `Animated` is not. So moving to the native driver made the loops *actually run* in tests for the first time, roughly doubling one suite's wall-clock time (240 ms → 425 ms of drift), which tipped a test that compared a fixture offset against a live `Date.now()` at render time. `waiting 45s` rendered as `waiting 47s`. **A device-performance win can be a test-suite cost**, and the failure surfaces far from the change.

## Alignments made mid-investigation

Things the method got wrong and had to correct, kept because the corrections are the transferable part:

- **Measured a component that was never on screen.** Considerable effort went into converting `WorkingCard`'s sweep bar — which turned out never to have been mounted in any of the eight runs, because that Hub had no `working`-tier sessions. Instrumenting every animated component with a mount log, which came late, showed the real idle offender was `KnightRiderScanner` (two instances, seven animated segments each, mounted during background refresh). **Instrument what is mounted before optimising what you assume is mounted.**
- **Re-ran a CI failure before reading it.** The repo's rule is to re-run a red check once, on the assumption of flakiness. Here the re-run failed identically, which was the real signal — and then local runs passed, which looked like it confirmed flakiness. What settled it was measuring the same suite on both branches: 240 ms vs 425 ms of drift. **"Passes locally, fails on CI, twice" is a load-sensitivity result, not a flake.**
- **Reported an unmeasured claim as measured, once.** Two of the four converted components were never on screen during the verification run. The PR says so explicitly, in its own section. A partial measurement described accurately is useful; described as complete it is worse than none.
- **Stated a PR was behind `main` without checking.** It was not; `git merge-base --is-ancestor` said so in one command. The block was a real test failure that the wrong diagnosis would have hidden behind a pointless rebase.

## Checklist

1. Find the global off switch for the subsystem you suspect (Reduce Motion, a feature flag, an empty data set) and measure with it on. That is your floor.
2. Decide the watched stacks before recording, not after.
3. Record the control and the change back to back, same screen, same data, same duration.
4. Prove the device is running the code you think it is, with output you deliberately added.
5. Check what is actually mounted, rather than what the diff suggests should be.
6. Report which conclusions are measured and which are inferred from the same mechanism.

## See also

- [`conversation-open-profile.md`](./conversation-open-profile.md) — the per-action equivalent, and a worked example of a harness that invalidated its own results
- [`troubleshooting.md`](./troubleshooting.md) → "Measuring the wrong thing" — the `EXPO_PUBLIC_*` flag and dev-client cache traps, with verify-and-fix commands
- [`a11y-theme-perf.md`](./a11y-theme-perf.md) — where Reduce Motion is wired into the components
- [`troubleshooting.md`](./troubleshooting.md) → "A repeated `simctl openurl` loop measures a screen stack you built, not the app" — harness invariants, and why the rig needs one per run

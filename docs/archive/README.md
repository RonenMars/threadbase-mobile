# docs/archive

> **WHAT THIS IS.** Work that was completed but never landed, kept because it would otherwise exist nowhere.
> Nothing here describes current behaviour, and nothing here should be applied without reading its own header first.
>
> **STATUS: EVERYTHING IN THIS DIRECTORY IS HISTORICAL BY DEFINITION.**

## What belongs here

An implementation that was finished and then overtaken — by a better diagnosis, a policy decision, or a change that removed its reason to exist.
Archive it when the code is gone from every branch but the reasoning behind it would cost someone real time to rediscover.

What does not belong here: anything still true. If a document describes how the app works today, it belongs in `docs/` proper.
Superseded ADRs stay in `docs/adr/` with their status updated, because an ADR's record of a decision is the point of it.

## The one rule

Every file starts with a header saying what it is and, in uppercase, whether it is obsolete.
A reader who lands here from a search result must learn that the content is dead before they learn anything else — the failure mode this directory exists to prevent is someone applying an archived fix in good faith.

State plainly why it did not land, since that is usually the most useful thing in the file.

## Contents

- [`2026-08-15-android-loopback-cleartext-attempt.md`](./2026-08-15-android-loopback-cleartext-attempt.md) — an Expo config plugin permitting cleartext HTTP to loopback and the emulator host on Android release builds. OBSOLETE: built on a wrong diagnosis, and too narrow for the defect it would now need to serve (#727).

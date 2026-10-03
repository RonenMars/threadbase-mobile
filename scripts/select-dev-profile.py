#!/usr/bin/env python3
"""Pick the installed development provisioning profile for one target.

Usage: select-dev-profile.py <bundle-id> <entitlements-file> <profile-dir>...

Prints the chosen profile's UUID on stdout and a one-line summary on stderr.
Exits 1 with every rejected candidate and its reasons on stderr when none fits.

A profile qualifies when it is for exactly <bundle-id>, is a development profile
(get-task-allow; an Ad Hoc profile also lists devices, so ProvisionedDevices
cannot tell them apart), is manually managed (manual signing refuses Xcode's
"iOS Team Provisioning Profile"), has not expired, and grants every entitlement
the target's entitlements file declares. Requirements come from that file so a
new capability — Time Sensitive Notifications was the first — is enforced here
the moment the target adopts it, and the widget is not held to the app's list.
Among qualifying profiles the newest CreationDate wins: regenerating a profile
in the portal issues a new UUID and leaves the stale copy installed beside it.
"""
import datetime
import glob
import os
import plistlib
import re
import subprocess
import sys

CAPABILITY_NAMES = {
    "aps-environment": "Push Notifications",
    "com.apple.security.application-groups": "App Groups",
    "com.apple.developer.usernotifications.time-sensitive": "Time Sensitive Notifications",
}


def load(path):
    with open(path, "rb") as f:
        raw = f.read()
    try:
        # Test fixtures are bare plists; a real profile is CMS-wrapped.
        return plistlib.loads(raw)
    except Exception:
        return plistlib.loads(subprocess.run(["security", "cms", "-D", "-i", path],
                                             capture_output=True, check=True).stdout)


def grants(profile_ent, key, wanted):
    have = profile_ent.get(key)
    if wanted is True:
        return have is True
    if isinstance(wanted, list):
        return isinstance(have, list) and set(wanted) <= set(have)
    return have is not None


def rejections(profile, bundle_id, required, now):
    ent = profile.get("Entitlements", {})
    app_id = ent.get("application-identifier", "")
    if app_id.partition(".")[2] != bundle_id:
        return [f"wrong bundle ID ({app_id.partition('.')[2] or 'none'})"]
    reasons = []
    if ent.get("get-task-allow") is not True:
        reasons.append("Ad Hoc instead of Development" if profile.get("ProvisionedDevices")
                       else "App Store instead of Development")
    if profile.get("IsXcodeManaged"):
        reasons.append("Xcode-managed (manual signing refuses it)")
    if profile.get("ExpirationDate", now) <= now:
        reasons.append("expired")
    for key, wanted in required.items():
        if not grants(ent, key, wanted):
            reasons.append(f"missing {CAPABILITY_NAMES.get(key, key)}")
    return reasons


def select(profiles, bundle_id, required, now):
    """Returns (chosen profile or None, [(profile, reasons)] for the rejected ones)."""
    valid, rejected = [], []
    for p in profiles:
        reasons = rejections(p, bundle_id, required, now)
        (rejected if reasons else valid).append((p, reasons))
    valid.sort(key=lambda pr: (pr[0].get("CreationDate", datetime.datetime.min),
                               pr[0].get("ExpirationDate", datetime.datetime.min),
                               pr[0].get("UUID", "")), reverse=True)
    return (valid[0][0] if valid else None), rejected


def main(argv):
    bundle_id, entitlements_path, *dirs = argv
    with open(entitlements_path, "rb") as f:
        # Unset build settings expand to nothing, which is what a dev build gets
        # for the TbDev suffix ship-qa.sh passes.
        required = plistlib.loads(re.sub(rb"\$\([A-Z_]+\)", b"", f.read()))
    by_uuid = {}
    for path in (p for d in dirs for p in sorted(glob.glob(os.path.join(d, "*.mobileprovision")))):
        try:
            profile = load(path)
        except Exception:
            continue
        # Xcode keeps copies in both directories; the same UUID is the same profile.
        by_uuid.setdefault(profile.get("UUID", path), profile)
    # plistlib yields naive datetimes in UTC.
    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    chosen, rejected = select(by_uuid.values(), bundle_id, required, now)
    if chosen:
        print(f"  {bundle_id}: {chosen.get('Name')} ({chosen['UUID']}, created "
              f"{chosen.get('CreationDate'):%Y-%m-%d %H:%M} UTC)", file=sys.stderr)
        print(chosen["UUID"])
        return 0
    print(f"No usable development profile for {bundle_id}.", file=sys.stderr)
    wrong_bundle = 0
    for p, reasons in sorted(rejected, key=lambda pr: pr[0].get("Name", "")):
        if reasons[0].startswith("wrong bundle ID"):
            wrong_bundle += 1
            continue
        print(f"  - {p.get('Name')} ({p.get('UUID')}): {', '.join(reasons)}", file=sys.stderr)
    if wrong_bundle:
        print(f"  ({wrong_bundle} other installed profiles: wrong bundle ID)", file=sys.stderr)
    print(f"  Required by {entitlements_path}: "
          f"{', '.join(CAPABILITY_NAMES.get(k, k) for k in required) or 'nothing'}",
          file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

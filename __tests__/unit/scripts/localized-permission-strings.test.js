/**
 * @jest-environment node
 *
 * Guards plugins/withLocalizedPermissionStrings.js — the plugin that makes
 * the four localized InfoPlist.strings files and their PBXVariantGroup
 * wiring survive `expo prebuild --clean`. Runs its pure pbxproj helpers
 * against the real committed project.pbxproj, so a change to the pbxproj's
 * group structure (e.g. renaming the "Threadbase" group) fails here rather
 * than as a plugin that silently stops finding its anchor.
 */

'use strict';

const path = require('path');

const xcode = require('xcode');

const {
  serializeInfoPlistStrings,
  findAppGroupKey,
  ensureVariantGroup,
  ensureGroupChild,
  ensureResourcesBuildFile,
  ensureLocaleFileReference,
  LOCALIZED_INFO_PLIST_STRINGS,
  LOCALES,
  VARIANT_GROUP_NAME,
} = require('../../../plugins/withLocalizedPermissionStrings');

const PBXPROJ = path.resolve(__dirname, '../../../ios/Threadbase.xcodeproj/project.pbxproj');

function parseProject() {
  const project = xcode.project(PBXPROJ);
  project.parseSync();
  return project;
}

function variantGroupCount(project) {
  return Object.keys(project.hash.project.objects.PBXVariantGroup || {}).filter(
    (key) => !key.endsWith('_comment'),
  ).length;
}

describe('serializeInfoPlistStrings', () => {
  it('formats each entry as a quoted InfoPlist.strings line', () => {
    expect(
      serializeInfoPlistStrings([
        ['A', 'one'],
        ['B', 'two'],
      ]),
    ).toBe('"A" = "one";\n"B" = "two";\n');
  });

  it('escapes embedded quotes and backslashes', () => {
    expect(serializeInfoPlistStrings([['K', 'say "hi"\\ok']])).toBe('"K" = "say \\"hi\\"\\\\ok";\n');
  });
});

describe('LOCALIZED_INFO_PLIST_STRINGS', () => {
  it('carries the same six keys, in the same order, for every locale', () => {
    const keys = LOCALIZED_INFO_PLIST_STRINGS.en.map(([key]) => key);
    expect(keys).toHaveLength(6);
    for (const locale of LOCALES) {
      expect(LOCALIZED_INFO_PLIST_STRINGS[locale].map(([key]) => key)).toEqual(keys);
    }
  });
});

describe('findAppGroupKey', () => {
  it('finds the Threadbase group containing Info.plist, not the unrelated same-named group', () => {
    const project = parseProject();
    const key = findAppGroupKey(project);

    expect(key).not.toBeNull();
    const group = project.getPBXGroupByKey(key);
    expect(group.children.some((child) => child.comment === 'Info.plist')).toBe(true);
  });
});

describe('pbxproj wiring against the real committed project', () => {
  // The committed project.pbxproj already has this plugin's wiring applied
  // by hand (see the commit that introduced these files). Every helper
  // should therefore report "already done" on the very first call here —
  // proving the plugin recognizes today's committed state as complete
  // rather than re-adding it on the next `expo prebuild --no-clean`.
  it('recognizes the already-committed variant group, link, build file, and locale refs', () => {
    const project = parseProject();
    const appGroupKey = findAppGroupKey(project);

    const variantGroupKey = ensureVariantGroup(project);
    expect(variantGroupCount(project)).toBe(1);

    expect(ensureGroupChild(project, appGroupKey, variantGroupKey, VARIANT_GROUP_NAME)).toBe(false);
    expect(ensureResourcesBuildFile(project, variantGroupKey)).toBe(false);
    for (const locale of LOCALES) {
      expect(ensureLocaleFileReference(project, variantGroupKey, locale)).toBe(false);
    }
  });
});

describe('pbxproj wiring idempotency from a clean slate', () => {
  // Strips the committed PBXVariantGroup section to exercise the path a
  // `--clean` prebuild actually takes: nothing wired yet. Two full passes
  // back to back must produce the exact same object counts, matching the
  // requirement that running prebuild twice never duplicates a group, a
  // build file, or a locale file reference.
  function wireOncePass(project, appGroupKey) {
    const variantGroupKey = ensureVariantGroup(project);
    ensureGroupChild(project, appGroupKey, variantGroupKey, VARIANT_GROUP_NAME);
    ensureResourcesBuildFile(project, variantGroupKey);
    for (const locale of LOCALES) {
      ensureLocaleFileReference(project, variantGroupKey, locale);
    }
    return variantGroupKey;
  }

  it('creates everything on the first pass and changes nothing on the second', () => {
    const project = parseProject();
    delete project.hash.project.objects.PBXVariantGroup;
    const appGroupKey = findAppGroupKey(project);

    const firstKey = wireOncePass(project, appGroupKey);
    expect(variantGroupCount(project)).toBe(1);
    const variantGroupAfterFirst = project.getPBXVariantGroupByKey(firstKey);
    expect(variantGroupAfterFirst.children).toHaveLength(LOCALES.length);

    const secondKey = wireOncePass(project, appGroupKey);
    expect(secondKey).toBe(firstKey);
    expect(variantGroupCount(project)).toBe(1);
    expect(project.getPBXVariantGroupByKey(firstKey).children).toHaveLength(LOCALES.length);
  });
});

describe('addKnownRegion (relied on directly, not wrapped)', () => {
  // The plugin calls xcode's own addKnownRegion() unwrapped because it is
  // already idempotent (checks hasKnownRegion() before pushing). This pins
  // that assumption so a future `xcode` upgrade that changed it would fail
  // here instead of surfacing as a duplicated knownRegions entry.
  it('adds he/ar/ru exactly once even when called twice', () => {
    const project = parseProject();
    for (const locale of ['he', 'ar', 'ru']) {
      project.addKnownRegion(locale);
      project.addKnownRegion(locale);
    }

    const regions = project.pbxProjectSection()[project.getFirstProject().uuid].knownRegions;
    for (const locale of ['he', 'ar', 'ru']) {
      expect(regions.filter((region) => region === locale)).toHaveLength(1);
    }
  });
});

/**
 * @jest-environment node
 *
 * Guards plugins/withLiveActivityTarget.js against the build-phase dependency
 * cycle it exists to prevent. Runs against the real committed project.pbxproj,
 * so a prebuild-template change that moves the anchors fails here rather than
 * as an opaque "Cycle inside Threadbase" on someone's next build.
 */

'use strict';

const path = require('path');

const xcode = require('xcode');

const { reorderEmbedPhase } = require('../../../plugins/withLiveActivityTarget');

const PBXPROJ = path.resolve(
  __dirname,
  '../../../ios/Threadbase.xcodeproj/project.pbxproj',
);

const EMBED_PHASE = 'Embed Foundation Extensions';
const ANCHOR_PHASE = 'Resources';

function parseProject() {
  const project = xcode.project(PBXPROJ);
  project.parseSync();
  return project;
}

function appTarget(project) {
  return Object.values(project.pbxNativeTargetSection()).find(
    (target) => target && target.name === 'Threadbase',
  );
}

function phaseNames(target) {
  return target.buildPhases.map((phase) => phase.comment);
}

describe('withLiveActivityTarget', () => {
  it('keeps the embed phase ahead of the script phases that consume Info.plist', () => {
    const target = appTarget(parseProject());
    const names = phaseNames(target);
    const embed = names.indexOf(EMBED_PHASE);

    expect(embed).toBeGreaterThan(-1);
    // The cycle comes back if any of these three precede the embed phase.
    for (const script of [
      '[Expo Dev Launcher] Strip Local Network Keys for Release',
      '[CP] Embed Pods Frameworks',
      'Upload Debug Symbols to Sentry',
    ]) {
      expect(embed).toBeLessThan(names.indexOf(script));
    }
  });

  it('is a no-op when the committed order is already correct', () => {
    expect(reorderEmbedPhase(parseProject())).toBe(false);
  });

  it('moves the phase when prebuild has appended it last', () => {
    const project = parseProject();
    const target = appTarget(project);
    const [embed] = target.buildPhases.splice(
      phaseNames(target).indexOf(EMBED_PHASE),
      1,
    );
    target.buildPhases.push(embed);

    expect(reorderEmbedPhase(project)).toBe(true);
    const names = phaseNames(target);
    expect(names.indexOf(EMBED_PHASE)).toBe(names.indexOf(ANCHOR_PHASE) + 1);
  });

  it('is idempotent — a second pass changes nothing', () => {
    const project = parseProject();
    const target = appTarget(project);
    const [embed] = target.buildPhases.splice(
      phaseNames(target).indexOf(EMBED_PHASE),
      1,
    );
    target.buildPhases.push(embed);

    reorderEmbedPhase(project);
    const afterFirst = phaseNames(target);
    expect(reorderEmbedPhase(project)).toBe(false);
    expect(phaseNames(target)).toEqual(afterFirst);
  });

  it('throws loudly when the embed phase is missing', () => {
    const project = parseProject();
    const target = appTarget(project);
    target.buildPhases = target.buildPhases.filter((p) => p.comment !== EMBED_PHASE);

    expect(() => reorderEmbedPhase(project)).toThrow(
      /live-activity-embed-order.*Embed Foundation Extensions/s,
    );
  });

  it('throws loudly when the anchor phase is missing', () => {
    const project = parseProject();
    const target = appTarget(project);
    target.buildPhases = target.buildPhases.filter((p) => p.comment !== ANCHOR_PHASE);

    expect(() => reorderEmbedPhase(project)).toThrow(
      /live-activity-embed-order.*Resources/s,
    );
  });

  it('throws loudly when the app target cannot be found', () => {
    const project = parseProject();
    appTarget(project).name = 'RenamedApp';

    expect(() => reorderEmbedPhase(project)).toThrow(
      /live-activity-embed-order.*Could not find native target/s,
    );
  });
});

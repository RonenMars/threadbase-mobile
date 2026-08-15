/**
 * @jest-environment node
 *
 * reactivecircus/android-emulator-runner splits its `script:` input on newlines
 * and runs each line as a separate `sh -c`, so shell state does not carry from
 * one line to the next and dash-incompatible syntax fails the job on its own.
 * Run 31853259980 burned a runner discovering that. The invariant is therefore
 * "the workflow's script: is one line, which invokes a real bash file" — a
 * regression here only shows up on a paid runner, so it is checked here.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const WORKFLOW = path.resolve(__dirname, '../../../.github/workflows/e2e.yml');

/** The `script:` value from the emulator step, as written in the YAML. */
function androidScriptLines() {
  const lines = fs.readFileSync(WORKFLOW, 'utf8').split('\n');
  const at = lines.findIndex((l) => /^\s*script:/.test(l));
  expect(at).toBeGreaterThan(-1);

  const header = lines[at];
  const inline = header.replace(/^\s*script:\s*/, '');
  if (inline && inline !== '|' && inline !== '>') return [inline];

  // Block scalar: every following line indented deeper than `script:` itself.
  const indent = header.search(/\S/);
  const body = [];
  for (const line of lines.slice(at + 1)) {
    if (line.trim() === '') continue;
    if (line.search(/\S/) <= indent) break;
    body.push(line.trim());
  }
  return body;
}

describe('e2e.yml Android emulator step', () => {
  it('passes the emulator action a single-line script', () => {
    expect(androidScriptLines()).toHaveLength(1);
  });

  it('invokes a bash file that exists and starts with a bash shebang', () => {
    const [command] = androidScriptLines();
    expect(command).toMatch(/^bash \S+\.sh$/);

    const target = path.resolve(__dirname, '../../..', command.split(' ')[1]);
    expect(fs.existsSync(target)).toBe(true);
    expect(fs.readFileSync(target, 'utf8').split('\n')[0]).toBe('#!/usr/bin/env bash');
  });
});

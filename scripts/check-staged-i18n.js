#!/usr/bin/env node
'use strict';

// Reports only `i18next/no-literal-string` findings for the files given as
// argv, and exits non-zero when there are any. Used by the pre-commit hook.
//
// Scoping to one rule is deliberate: the repo carries 266 pre-existing errors
// from unrelated rules, so an unfiltered run would bury the finding the hook
// exists to surface.

const { execFileSync } = require('child_process');
const path = require('path');

const RULE = 'i18next/no-literal-string';

const files = process.argv.slice(2);
if (files.length === 0) process.exit(0);

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim();

const eslintBin = path.join(repoRoot, 'node_modules', 'eslint', 'bin', 'eslint.js');

let report;
try {
  const stdout = execFileSync(process.execPath, [eslintBin, '-f', 'json', ...files], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  report = JSON.parse(stdout);
} catch (err) {
  // ESLint exits non-zero whenever any rule errors, which is expected here —
  // the findings we care about are still on stdout. A genuine crash leaves
  // stdout unparseable, and that is what should surface.
  try {
    report = JSON.parse(err.stdout || '');
  } catch {
    process.stderr.write(`check-staged-i18n: eslint failed\n${err.stderr || err.message}\n`);
    process.exit(1);
  }
}

const hits = [];
for (const file of report) {
  for (const m of file.messages) {
    if (m.ruleId === RULE) {
      hits.push(`  ${path.relative(repoRoot, file.filePath)}:${m.line}  ${m.message}`);
    }
  }
}

if (hits.length === 0) process.exit(0);

process.stderr.write(
  `\n${hits.length} hardcoded user-facing string(s) in staged files:\n\n${hits.join('\n')}\n\n` +
    'Route these through t(). If a string is technical rather than copy — a URL\n' +
    'fragment, a CLI flag, an enum discriminant — extract it to a const with an\n' +
    'eslint-disable-next-line and a comment saying why.\n\n'
);
process.exit(1);

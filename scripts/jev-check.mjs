#!/usr/bin/env node
// Asks Jev (TypeSafe System One) one yes/no question per acceptance criterion about the current branch's diff,
// and prints how likely each criterion holds. A triage aid for review, never a verdict: CHECK rows need a human look.
//
//   TYPESAFE_API_KEY=… node scripts/jev-check.mjs --criteria docs/followups/floating-chat-shelf-criteria.json [--base main] [--threshold 0.7] [--strict] [--dry-run]
//   node scripts/jev-check.mjs --self-test
//
// Sends the diff of the matching files to api.typesafe.ai. Local dev tool only; not for CI.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const MODEL = 'jev-1.13.0'; // pinned: thresholds are tuned against one version, and `jev-latest` moves
const URL_ = 'https://api.typesafe.ai/v1/systemone';
const BATCH_CHARS = 80_000; // ~20k tokens of diff per request; Jev allows 32k for state plus the longest question

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, dflt) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : dflt);

/** Splits `git diff` output into { path: patch } per file. */
export function splitDiff(diff) {
  const out = {};
  for (const part of diff.split(/^(?=diff --git )/m)) {
    const m = part.match(/^diff --git a\/(.+?) b\//);
    if (m) out[m[1]] = part;
  }
  return out;
}

/** A criterion applies to a file when any of its `paths` prefixes match; no `paths` means every file. */
export const applies = (c, file) => !c.paths?.length || c.paths.some((p) => file.startsWith(p));

/** Greedy batches of files whose patches fit the budget; an oversized patch is truncated into its own batch. */
export function batches(files, patches, budget = BATCH_CHARS) {
  const out = [];
  let cur = {};
  let size = 0;
  for (const f of files) {
    const p = patches[f].length > budget ? patches[f].slice(0, budget) + '\n[truncated]' : patches[f];
    if (size + p.length > budget && size > 0) { out.push(cur); cur = {}; size = 0; }
    cur[f] = p;
    size += p.length;
  }
  if (size > 0) out.push(cur);
  return out;
}

/** Evidence can sit in any batch, so a criterion's probability is the max across batches; `expect: false` inverts it. */
export function verdict(c, probs, threshold) {
  // No matching file: a "must not" criterion trivially holds, a "must" criterion is missing.
  if (!probs.length) return { p: null, score: null, status: c.expect === false ? 'PASS' : 'CHECK' };
  const p = Math.max(...probs);
  const score = c.expect === false ? 1 - p : p;
  return { p, score, status: score >= threshold ? 'PASS' : 'CHECK' };
}

function selfTest() {
  const assert = (ok, what) => { if (!ok) throw new Error(`self-test failed: ${what}`); };
  const d = 'diff --git a/a.ts b/a.ts\n+x\ndiff --git a/b/c.ts b/b/c.ts\n+y\n';
  const s = splitDiff(d);
  assert(Object.keys(s).join() === 'a.ts,b/c.ts', 'splitDiff');
  assert(applies({ paths: ['b/'] }, 'b/c.ts') && !applies({ paths: ['b/'] }, 'a.ts') && applies({}, 'a.ts'), 'applies');
  const b = batches(['a', 'b', 'c'], { a: 'x'.repeat(6), b: 'x'.repeat(6), c: 'x'.repeat(20) }, 10);
  assert(b.length === 3 && b[2].c.endsWith('[truncated]'), 'batches');
  assert(verdict({ expect: false }, [0.1, 0.2], 0.7).status === 'PASS' && verdict({}, [0.2, 0.9], 0.7).status === 'PASS' && verdict({}, [0.4], 0.7).status === 'CHECK', 'verdict');
  console.log('self-test ok');
}

function currentDiff(base) {
  const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64e6 });
  const tracked = git('diff', '--no-color', '--merge-base', base);
  // New files the builder has not staged are part of the change too.
  const untracked = git('ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean)
    .filter((f) => fs.statSync(f).size < 200_000 && !/\.(png|jpe?g|gif|webp|ttf|otf|mp4|zip)$/i.test(f))
    .map((f) => `diff --git a/${f} b/${f}\nnew file (untracked)\n` + fs.readFileSync(f, 'utf8').split('\n').map((l) => '+' + l).join('\n') + '\n')
    .join('');
  return splitDiff(tracked + untracked);
}

async function ask(state, questions, key) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(URL_, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, state, questions }),
      signal: AbortSignal.timeout(30_000),
    });
    if ((res.status === 429 || res.status === 529) && attempt < 3) { await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt)); continue; }
    if (!res.ok) throw new Error(`TypeSafe ${res.status}: ${await res.text()}`);
    return res.json();
  }
}

async function main() {
  if (flag('self-test')) return selfTest();
  const file = opt('criteria');
  if (!file) throw new Error('--criteria <file.json> is required');
  const { context, criteria } = JSON.parse(fs.readFileSync(file, 'utf8'));
  const threshold = Number(opt('threshold', '0.7'));
  const key = process.env.TYPESAFE_API_KEY;
  if (!key && !flag('dry-run')) throw new Error('TYPESAFE_API_KEY is not set (or pass --dry-run)');

  const patches = currentDiff(opt('base', 'main'));
  const probs = Object.fromEntries(criteria.map((c) => [c.id, []]));
  let tokens = 0;
  let model = MODEL;
  // Criteria sharing the same `paths` see the same files, so they share one request per batch.
  const groups = new Map();
  for (const c of criteria) groups.set(JSON.stringify(c.paths ?? []), [...(groups.get(JSON.stringify(c.paths ?? [])) ?? []), c]);
  for (const group of groups.values()) {
    const files = Object.keys(patches).filter((f) => applies(group[0], f));
    for (const changes of batches(files, patches)) {
      const questions = Object.fromEntries(group.map((c) => [c.id, {
        type: 'noul',
        instructions: { feature: context, question: `\`changes\` maps each changed file to its git diff (lines starting with + are added). ${c.question}` },
        ...(c.criteria ? { criteria: c.criteria } : {}),
      }]));
      if (flag('dry-run')) { console.log(`would ask ${group.length} question(s) over ${Object.keys(changes).length} file(s), ${JSON.stringify(changes).length} chars`); continue; }
      const r = await ask({ changes }, questions, key);
      tokens += r.usage?.input_tokens ?? 0;
      model = r.model ?? model;
      for (const c of group) probs[c.id].push(r.answers[c.id].noul);
    }
  }
  if (flag('dry-run')) return;

  const rows = criteria.map((c) => ({ id: c.id, expect: c.expect === false ? 'no' : 'yes', ...verdict(c, probs[c.id], threshold) }));
  console.table(rows.map((r) => ({ ...r, p: r.p?.toFixed(2) ?? '-', score: r.score?.toFixed(2) ?? '-' })));
  console.log(`model ${model}, ${tokens} input tokens (~$${((tokens / 1e6) * 0.042).toFixed(5)}), threshold ${threshold}`);
  console.log('CHECK = look at it yourself; PASS is likely, not proven.');
  if (flag('strict') && rows.some((r) => r.status === 'CHECK')) process.exitCode = 1;
}

main().catch((e) => { console.error(e.message); process.exitCode = 2; });

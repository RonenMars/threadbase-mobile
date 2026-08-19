#!/usr/bin/env node
'use strict'
// check-story-coverage.js — block a commit that adds a new components/ file
// without a matching *.stories.tsx, and warn (non-blocking) when an existing
// one is modified without one.
//
// A new component with no story silently rots the catalog: nobody notices
// it's missing until someone goes looking for an example that isn't there.
// Modified components only warn — judging whether adding a story is "small
// effort" for an existing component is a human/agent call, not something a
// hook can decide.
//
// Exemptions: list a path in scripts/git-hooks/story-exempt.txt (one per
// line, same format as ci-paths.txt) for components that genuinely can't be
// storied (native-API-only, screen-sized compositions, etc).

const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const REPO_ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
const EXEMPT_FILE = path.join(REPO_ROOT, 'scripts/git-hooks/story-exempt.txt')

function loadExemptions() {
  if (!fs.existsSync(EXEMPT_FILE)) return new Set()
  return new Set(
    fs
      .readFileSync(EXEMPT_FILE, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
  )
}

function isComponentFile(file) {
  return (
    file.startsWith('components/') &&
    file.endsWith('.tsx') &&
    !file.endsWith('.stories.tsx') &&
    !file.endsWith('.test.tsx')
  )
}

function storyPathFor(file) {
  return file.replace(/\.tsx$/, '.stories.tsx')
}

function hasStory(file) {
  return fs.existsSync(path.join(REPO_ROOT, storyPathFor(file)))
}

function main() {
  const statusOutput = execFileSync(
    'git',
    ['diff', '--cached', '--name-status', '--diff-filter=ACMR'],
    { cwd: REPO_ROOT, encoding: 'utf8' }
  )

  const exemptions = loadExemptions()
  const added = []
  const modified = []

  for (const line of statusOutput.split('\n')) {
    if (!line.trim()) continue
    const parts = line.split('\t')
    const status = parts[0]
    const file = parts[parts.length - 1] // renames: "R100\told\tnew" — new path is last
    if (!isComponentFile(file) || exemptions.has(file)) continue
    if (hasStory(file)) continue
    if (status.startsWith('A') || status.startsWith('R')) {
      added.push(file)
    } else if (status.startsWith('M')) {
      modified.push(file)
    }
  }

  if (modified.length > 0) {
    console.warn('\nStorybook: modified component(s) with no story — add one if it\'s small:')
    for (const file of modified) {
      console.warn(`  ${file}  →  ${storyPathFor(file)}`)
    }
    console.warn('')
  }

  if (added.length > 0) {
    console.error('\nStorybook: new component(s) require a story before commit (not optional):')
    for (const file of added) {
      console.error(`  ${file}  →  ${storyPathFor(file)}`)
    }
    console.error(
      '\nAdd the missing *.stories.tsx file(s), or list the path in scripts/git-hooks/story-exempt.txt with a reason if it genuinely can\'t be storied.\n'
    )
    process.exit(1)
  }
}

main()

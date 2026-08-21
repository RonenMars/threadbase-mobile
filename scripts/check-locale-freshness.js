#!/usr/bin/env node
'use strict'
// check-locale-freshness.js — detect an English source string that changed
// without its translations ever being re-checked. Key parity
// (__tests__/i18n-completeness.test.ts) only proves every locale HAS a key;
// it can't prove the value behind it was revisited after en changed. This
// script hashes each en value and compares it to the hash recorded the last
// time someone confirmed the translations, so an en edit nobody re-checked
// shows up as drift (e.g. pair.json's ru "Отпечаток (хеш)" leftover from the
// #804 fingerprint→identity-code rename, which key parity alone missed).
//
// Usage:
//   node scripts/check-locale-freshness.js          # check for drift
//   node scripts/check-locale-freshness.js --bless  # re-record current hashes

const crypto = require('crypto')
const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const { flatten, listNamespaces, readNamespace, leafToString } = require('./lib/locale-walk')

function resolveLocalesDir() {
  if (process.env.LOCALE_CHECK_DIR) return process.env.LOCALE_CHECK_DIR
  const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
  return path.join(repoRoot, 'locales')
}

const LOCALES_DIR = resolveLocalesDir()
const HASH_FILE = path.join(LOCALES_DIR, '.source-hashes.json')
const REFERENCE = 'en'
const HASH_LENGTH = 12

function hashValue(value) {
  return crypto.createHash('sha1').update(leafToString(value)).digest('hex').slice(0, HASH_LENGTH)
}

function currentHashes() {
  const hashes = {}
  for (const nsFile of listNamespaces(LOCALES_DIR, REFERENCE)) {
    const flat = flatten(readNamespace(LOCALES_DIR, REFERENCE, nsFile))
    for (const [key, value] of Object.entries(flat)) {
      hashes[`${nsFile}:${key}`] = hashValue(value)
    }
  }
  return hashes
}

function bless() {
  const hashes = currentHashes()
  fs.writeFileSync(HASH_FILE, `${JSON.stringify(hashes, null, 2)}\n`)
  console.log(`Recorded ${Object.keys(hashes).length} source hashes to ${HASH_FILE}`)
}

function check() {
  if (!fs.existsSync(HASH_FILE)) {
    console.error(`No source-hashes file found at ${HASH_FILE}.\nRun: node scripts/check-locale-freshness.js --bless`)
    process.exit(1)
  }

  const recorded = JSON.parse(fs.readFileSync(HASH_FILE, 'utf8'))
  const current = currentHashes()

  const drifted = Object.keys(recorded)
    .filter((key) => key in current && current[key] !== recorded[key])
    .sort()

  if (drifted.length === 0) {
    console.log('Locale freshness OK — no English source strings changed since the last bless.')
    return
  }

  console.error(`${drifted.length} English source string(s) changed since translations were last confirmed:`)
  for (const key of drifted) {
    console.error(`  ${key}`)
  }
  console.error(
    '\nRe-check the other locales for these keys, then run:\n  node scripts/check-locale-freshness.js --bless'
  )
  process.exit(1)
}

function main() {
  if (process.argv.includes('--bless')) {
    bless()
  } else {
    check()
  }
}

main()

#!/usr/bin/env node
'use strict'
// check-locale-untranslated.js — flag a locale value that's byte-identical
// to its English source AND reads as prose, i.e. was probably never
// translated. Key parity alone can't tell "translated" from "copy-pasted
// from en" (see the settings.backup.* group and notificationHealth.hint*
// keys, which are verbatim English in he/ar/ru). A short brand name or
// placeholder can legitimately be identical across locales — allowlist it in
// locales/.identical-ok.json instead of relaxing the prose heuristic.
//
// Usage: node scripts/check-locale-untranslated.js

const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const { flatten, listLocales, listNamespaces, readNamespace, leafToString } = require('./lib/locale-walk')

function resolveLocalesDir() {
  if (process.env.LOCALE_CHECK_DIR) return process.env.LOCALE_CHECK_DIR
  const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
  return path.join(repoRoot, 'locales')
}

const LOCALES_DIR = resolveLocalesDir()
const ALLOWLIST_FILE = path.join(LOCALES_DIR, '.identical-ok.json')
const REFERENCE = 'en'

const INTERPOLATION = /\{\{[^}]*\}\}/g
const WORD_TOKEN = /[A-Za-z]{2}/

function loadAllowlist() {
  if (!fs.existsSync(ALLOWLIST_FILE)) return {}
  return JSON.parse(fs.readFileSync(ALLOWLIST_FILE, 'utf8'))
}

function looksLikeProse(value) {
  const stripped = value.replace(INTERPOLATION, ' ').trim()
  if (!stripped) return false
  if (stripped.includes('@') || stripped.includes('://')) return false
  if (!/[a-z]/.test(stripped)) return false // all-caps / digits / punctuation only
  const wordTokens = stripped.split(/\s+/).filter((token) => WORD_TOKEN.test(token))
  return wordTokens.length >= 3
}

function findUntranslated() {
  const allowlist = loadAllowlist()
  const findings = []

  for (const locale of listLocales(LOCALES_DIR).filter((l) => l !== REFERENCE)) {
    for (const nsFile of listNamespaces(LOCALES_DIR, REFERENCE)) {
      const enFlat = flatten(readNamespace(LOCALES_DIR, REFERENCE, nsFile))
      const locFlat = flatten(readNamespace(LOCALES_DIR, locale, nsFile))

      for (const [key, enValue] of Object.entries(enFlat)) {
        if (!(key in locFlat)) continue // missing keys are i18n-completeness's job

        if (JSON.stringify(locFlat[key]) !== JSON.stringify(enValue)) continue

        const fullKey = `${nsFile}:${key}`
        if (allowlist[fullKey]) continue

        if (looksLikeProse(leafToString(enValue))) {
          findings.push({ locale, fullKey, value: leafToString(enValue) })
        }
      }
    }
  }

  return findings
}

function main() {
  const findings = findUntranslated()

  if (findings.length === 0) {
    console.log('No untranslated prose values found.')
    return
  }

  console.error(`${findings.length} value(s) look untranslated (identical to English and read as prose):`)
  for (const { locale, fullKey, value } of findings) {
    console.error(`  ${locale}/${fullKey}: "${value}"`)
  }
  console.error(
    '\nTranslate these keys, or if the value is legitimately identical (brand name, placeholder, ' +
      'protocol string), add it to locales/.identical-ok.json with a short reason.'
  )
  process.exit(1)
}

main()

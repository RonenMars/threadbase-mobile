'use strict'
// locale-walk.js — shared traversal helpers for locale-quality check scripts
// (check-locale-freshness.js, check-locale-untranslated.js). Keeps the
// namespace/flatten logic in one place instead of duplicating it per script.

const fs = require('fs')
const path = require('path')

// Namespaces mix plain-object trees with array leaves (e.g. browse.json's
// rotating "starting.phrases" list) — only descend into plain objects.
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Flatten a nested locale namespace object into {"dotted.key": leafValue} pairs. */
function flatten(obj, prefix = '') {
  return Object.entries(obj).reduce((acc, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k
    if (isPlainObject(v)) {
      Object.assign(acc, flatten(v, key))
    } else {
      acc[key] = v
    }
    return acc
  }, {})
}

function listLocales(localesDir) {
  return fs
    .readdirSync(localesDir)
    .filter((entry) => fs.statSync(path.join(localesDir, entry)).isDirectory())
    .sort()
}

function listNamespaces(localesDir, referenceLocale) {
  return fs
    .readdirSync(path.join(localesDir, referenceLocale))
    .filter((f) => f.endsWith('.json'))
    .sort()
}

function readNamespace(localesDir, locale, nsFile) {
  const raw = fs.readFileSync(path.join(localesDir, locale, nsFile), 'utf8')
  return JSON.parse(raw)
}

/** A leaf value as plain text — arrays join into one string so hash/prose checks see text. */
function leafToString(value) {
  return Array.isArray(value) ? value.join(' ') : String(value)
}

module.exports = { flatten, listLocales, listNamespaces, readNamespace, leafToString }

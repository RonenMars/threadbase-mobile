#!/usr/bin/env node

/**
 * Migration script for @testing-library/react-native v14
 * Converts all render() and renderHook() calls to await syntax
 */

const fs = require('fs');
const path = require('path');

function migrateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Pattern 1: const { ... } = render(...) → const { ... } = await render(...)
  if (/const\s+\{[^}]+\}\s+=\s+render\(/.test(content)) {
    content = content.replace(
      /(\s+)const\s+(\{[^}]+\})\s+=\s+render\(/g,
      '$1const $2 = await render('
    );
    modified = true;
  }

  // Pattern 2: const result = render(...) → const result = await render(...)
  if (/const\s+\w+\s+=\s+render\(/.test(content)) {
    content = content.replace(
      /(\s+)const\s+(\w+)\s+=\s+render\(/g,
      '$1const $2 = await render('
    );
    modified = true;
  }

  // Pattern 3: renderHook calls
  if (content.includes('renderHook(')) {
    content = content.replace(
      /(\s+)const\s+(\{[^}]+\}|\w+)\s+=\s+renderHook\(/g,
      '$1const $2 = await renderHook('
    );
    modified = true;
  }

  // Pattern 4: Make test functions async if they aren't already
  if (modified) {
    // it('...', () => { → it('...', async () => {
    content = content.replace(
      /(\s+it\([^,]+,\s+)\(\)\s+=>/g,
      '$1async () =>'
    );
  }

  // Pattern 5: fireEvent calls should be awaited
  if (content.includes('fireEvent.')) {
    content = content.replace(
      /(\s+)(fireEvent\.(press|changeText|scroll)\([^)]+\))/g,
      '$1await $2'
    );
    // Remove double awaits
    content = content.replace(/await\s+await\s+fireEvent/g, 'await fireEvent');
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Migrated: ${filePath}`);
  }

  return modified;
}

function processDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let count = 0;

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      count += processDirectory(fullPath);
    } else if (entry.isFile() && /\.test\.(tsx?|jsx?)$/.test(entry.name)) {
      if (migrateFile(fullPath)) {
        count++;
      }
    }
  }

  return count;
}

const testsDir = path.join(__dirname, '..', '__tests__');
console.log('Migrating test files to @testing-library/react-native v14...\n');
const count = processDirectory(testsDir);
console.log(`\n✓ Migrated ${count} test files`);

#!/usr/bin/env node

/**
 * Fix remaining @testing-library/react-native v14 issues
 */

const fs = require('fs');
const path = require('path');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Fix hook test patterns: const { result } = renderHook(...) → const { result } = await renderHook(...)
  if (content.includes('renderHook') && /const\s+\{\s*result\s*\}\s+=\s+renderHook\(/.test(content)) {
    content = content.replace(
      /(\s+)const\s+(\{\s*result\s*\})\s+=\s+renderHook\(/g,
      '$1const $2 = await renderHook('
    );
    modified = true;
  }

  // Fix hook test patterns with destructuring: const { result, ... } = renderHook(...)
  if (content.includes('renderHook') && /const\s+\{[^}]*result[^}]*\}\s+=\s+renderHook\(/.test(content)) {
    content = content.replace(
      /(\s+)const\s+(\{[^}]+result[^}]*\})\s+=\s+renderHook\(/g,
      '$1const $2 = await renderHook('
    );
    modified = true;
  }

  // Fix hook test unmount pattern: result.unmount() where result comes from renderHook
  if (content.includes('.unmount') && content.includes('renderHook')) {
    content = content.replace(
      /(\s+)const\s+(\w+)\s+=\s+renderHook\(/g,
      '$1const $2 = await renderHook('
    );
    modified = true;
  }

  // Fix rerender pattern
  if (content.includes('.rerender') && content.includes('renderHook')) {
    content = content.replace(
      /(\w+)\.rerender\(/g,
      'await $1.rerender('
    );
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Fixed: ${filePath}`);
  }

  return modified;
}

const files = [
  '__tests__/unit/hooks/useConversationStream.reconnect.test.tsx',
  '__tests__/unit/hooks/useConversationStream.statusRefetch.test.tsx',
  '__tests__/unit/hooks/useTerminalStream.watchdog.test.tsx',
];

console.log('Fixing remaining hook test issues...\n');
let count = 0;

for (const file of files) {
  const fullPath = path.join(__dirname, '..', file);
  if (fs.existsSync(fullPath) && fixFile(fullPath)) {
    count++;
  }
}

console.log(`\n✓ Fixed ${count} files`);

// The docs keep up with the code: every source file has an entry in docs/folder-structure.md, every test file is described
// in docs/tests.md, and every doc that CLAUDE.md points to exists. (Several tools add files; this is what stops the docs
// drifting again. To fix a failure, add the missing one-line entry rather than loosening the test.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const read = (path) => readFileSync(path, 'utf8');

function filesUnder(dir, keep) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && keep(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));
}

test('every source file has an entry in docs/folder-structure.md', () => {
  const doc = read('docs/folder-structure.md');
  const missing = filesUnder('src', (name) => /\.(js|css)$/.test(name)).filter((file) => !doc.includes(basename(file)));
  assert.deepEqual(missing, [], `add a line for each to docs/folder-structure.md, under its folder: ${missing.join(', ')}`);
});

test('every test file is described in docs/tests.md', () => {
  const doc = read('docs/tests.md');
  const missing = readdirSync('tests').filter((name) => name.endsWith('.test.js'))
    .filter((name) => !doc.includes(name) && !new RegExp(`\\b${name.replace('.test.js', '')}\\b`).test(doc));
  assert.deepEqual(missing, [], `describe each in docs/tests.md: ${missing.join(', ')}`);
});

test('every doc CLAUDE.md points to exists', () => {
  const linked = [...new Set(read('CLAUDE.md').match(/docs\/[\w./-]+\.md/g) ?? [])];
  assert.ok(linked.length >= 5, 'CLAUDE.md links its docs');
  const missing = linked.filter((path) => !existsSync(path));
  assert.deepEqual(missing, [], `CLAUDE.md links to docs that don't exist: ${missing.join(', ')}`);
});

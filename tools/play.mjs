// =============================================================================
// PLAY (`npm run play`, or double-click play.cmd): open the game in one step, with no server to start or keep running.
// Opens the single-file build (tools/buildSingle.mjs) straight from disk, rebuilding it first only if the code has changed since.
// If that rebuild fails (someone is halfway through an edit) the last good build goes back and opens anyway, with a warning.
// Firefox is picked by name because Windows may send .html files to another browser; without it, the system's default opens the game.
// =============================================================================

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = join(root, 'dist-single', 'sunset-galleria.html');

// Everything that ends up in the single file.
export function sourceFiles(base = root) {
  const fromSrc = readdirSync(join(base, 'src'), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
  return [...fromSrc, ...['index.html', 'package.json', 'vite.config.js', 'tools/buildSingle.mjs'].map((file) => join(base, file))];
}

export const isStale = (builtAt, sourceTimes) => builtAt === null || sourceTimes.some((time) => time > builtAt);

function build() {
  const lastGood = existsSync(GAME) ? readFileSync(GAME) : null; // (the build empties dist-single/ before it starts)
  console.log('The code has changed: rebuilding the game...');
  const built = spawnSync(process.execPath, [join(root, 'tools', 'buildSingle.mjs')], { cwd: root, stdio: 'inherit' }).status === 0;
  if (built) return true;
  if (lastGood) {
    mkdirSync(dirname(GAME), { recursive: true });
    writeFileSync(GAME, lastGood);
  }
  return false;
}

function firefox() {
  const folders = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA].filter(Boolean);
  return folders.map((folder) => join(folder, 'Mozilla Firefox', 'firefox.exe')).find((path) => existsSync(path));
}

function open(file) {
  const defaultBrowser = { win32: 'explorer.exe', darwin: 'open' }[process.platform] ?? 'xdg-open';
  const browser = process.platform === 'win32' ? firefox() : null;
  const [command, target] = browser ? [browser, pathToFileURL(file).href] : [defaultBrowser, file];
  spawn(command, [target], { detached: true, stdio: 'ignore' }).unref();
}

function play() {
  const builtAt = existsSync(GAME) ? statSync(GAME).mtimeMs : null;
  const stale = isStale(builtAt, sourceFiles().map((file) => statSync(file).mtimeMs));
  const built = !stale || build();
  if (!built && !existsSync(GAME)) {
    console.error('The build failed and there is no earlier one to open.');
    process.exitCode = 1;
    return;
  }
  if (!built) {
    console.error('\nThe build failed, so this opens the LAST WORKING version, without your newest changes.');
    process.exitCode = 1; // (play.cmd stays open so this can be read)
  }
  open(GAME);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) play();

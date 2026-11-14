// Dev-server settings: `npm run dev` is the only thing they change. (Vite serves the game as separate files and compiles each one the
// first time it is asked for, in memory, so every server start begins cold. Builds are unaffected.)
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const forwardSlashes = (path) => path.replaceAll('\\', '/');

// Folders the game never loads from. Absolute, from THIS checkout, on purpose: a `**/.claude/**` glob would also match every file of a
// checkout that itself sits in .claude/worktrees/ and silently turn off its hot reload.
const notSource = ['.claude', 'dist', 'dist-single', 'dist-audition', 'references', 'scratch'].map((folder) => forwardSlashes(resolve(root, folder)));

export const isNotSource = (path) => {
  const file = forwardSlashes(path);
  return notSource.some((folder) => file === folder || file.startsWith(`${folder}/`));
};

export default {
  // Only the real page decides what gets pre-bundled, not any other .html left in dist-single/ or a worktree.
  optimizeDeps: { entries: ['index.html'] },
  server: {
    // Compile the game while the server starts, not while the browser waits. boot.js imports main.js dynamically and the music is a
    // worker, so neither is reached by following boot.js's own imports: each is listed. Vite follows the rest from these.
    warmup: { clientFiles: ['./src/boot.js', './src/main.js', './src/audio/musicWorker.js'] },
    watch: { ignored: isNotSource },
  },
};

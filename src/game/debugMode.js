// =============================================================================
// DEBUG MODE: is it on? (config/debug.js says what it turns on and the three ways in.) Decided once, when the page opens:
// main.js asks with the build's dev flag, the address's query string and the saved Settings switch. Pure: the tests call it too.
//
//   debugModeOn({ dev, search, saved }) -> true | false
//     dev     true on the dev server (import.meta.env.DEV)
//     search  the address's query string ('?debug')
//     saved   the saved 'debugMode' setting (game/settings.js readSavedSetting)
// =============================================================================
import { debug } from '../config/debug.js';

export function debugModeOn({ dev = false, search = '', saved = false } = {}) {
  const { inDev, urlFlag } = debug.mode;
  return (inDev && dev === true) || new URLSearchParams(search).has(urlFlag) || saved === true;
}

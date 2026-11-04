// The page's entry point: fonts first, then the game (main.js builds every canvas texture as it loads).
import { fonts } from './config/fonts.js';
import { waitForFonts } from './core/fontsReady.js';

waitForFonts(document, fonts).then(() => import('./main.js'));

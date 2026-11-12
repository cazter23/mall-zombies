// =============================================================================
// RADIO TICKER: a small "Now playing" card for Galleria FM (config/music.js `ticker`). audio/sound.js calls back when a
// song starts from its top where you can hear it; main.js shows it here. It slides in, stays a few seconds, slides out.
// =============================================================================

import { radio } from '../config/music.js';

export function createRadioTicker() {
  const element = document.createElement('div');
  element.className = 'radio-ticker';
  element.setAttribute('aria-live', 'polite');
  const station = document.createElement('span');
  station.className = 'radio-station';
  station.textContent = `${radio.station} · ${radio.ticker.label}`;
  const title = document.createElement('span');
  title.className = 'radio-title';
  element.append(station, title);
  let timer = null;
  return {
    element,
    /** Show the card for a song ({ title }). */
    show(track) {
      title.textContent = track.title;
      element.classList.add('show');
      clearTimeout(timer);
      timer = setTimeout(() => element.classList.remove('show'), radio.ticker.seconds * 1000);
    },
    get showing() { return element.classList.contains('show'); },
    get title() { return title.textContent; },
  };
}

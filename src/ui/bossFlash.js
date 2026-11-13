import { bossComfort } from '../config/bosses.js';
import { powerUps } from '../config/powerUps.js';

export function flashPresentation(flash) {
  return { color: bossComfort.dimPhoneFlash ? '#000' : (flash.color ?? '#fff'), opacity: bossComfort.dimPhoneFlash ? flash.dimOpacity : flash.opacity };
}

export function createBossFlashView() {
  const element = document.createElement('div');
  element.className = 'boss-phone-flash';
  element.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0';
  let animation;
  function clear() { animation?.cancel(); animation = null; }
  function trigger(flash) {
    clear();
    const presentation = flashPresentation(flash);
    element.style.background = presentation.color;
    animation = element.animate?.([{ opacity: presentation.opacity }, { opacity: 0 }], { duration: flash.seconds * 1000, easing: 'ease-out' });
  }
  return {
    element,
    connect(events) {
      events.on('bossFlash', trigger);
      events.on('clearanceDetonated', () => {
        const cf = powerUps.visual.clearanceFlash;
        trigger({ opacity: cf.maxOpacity, dimOpacity: 0.16, seconds: cf.fadeOutSeconds, color: cf.color });
      });
      events.on('runReset', clear);
      events.on('playerDeath', clear);
    },
  };
}

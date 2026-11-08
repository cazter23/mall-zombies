// Build-A-Blaster's Birth Certificate: a printed form that drops onto the screen when you collect a finished gun. It is a notice, not a
// menu: you are mid-fight, so nothing pauses and it clears itself (presentation only: its timer touches no gameplay).
import { ui } from '../config/ui.js';
import { certificateSubtitle } from '../config/workshop.js';

export function createBirthCertificate({ autoHide = true } = {}) {
  const element = document.createElement('div');
  element.className = 'birth-certificate';
  element.hidden = true;
  element.innerHTML = `
    <div class="certificate-title">Certificate of Birth</div>
    <div class="certificate-sub">Build-A-Blaster · Sunset Galleria · Level 2</div>
    <div class="certificate-name"></div>
    <div class="certificate-gun"></div>
    <dl class="certificate-lines">
      <dt>Model</dt><dd data-field="combo"></dd>
      <dt>Stuffing</dt><dd data-field="stuffing"></dd>
      <dt>Heart</dt><dd data-field="heart"></dd>
      <dt>Condition</dt><dd data-field="quality"></dd>
      <dt>Weight</dt><dd data-field="kills"></dd>
      <dt>Born</dt><dd data-field="round"></dd>
    </dl>
    <div class="certificate-remark"></div>
    <div class="certificate-note"></div>`;
  const put = (selector, text) => { element.querySelector(selector).textContent = text; };
  let timer = null;

  function hide() {
    clearTimeout(timer);
    element.hidden = true;
  }

  return {
    element,
    hide,
    show({ name, gunName, combo, stuffing, heart, quality, kills, round, remark, note = '' }) {
      put('.certificate-name', name);
      put('.certificate-gun', certificateSubtitle(quality, gunName));
      put('[data-field="combo"]', combo);
      put('[data-field="stuffing"]', stuffing);
      put('[data-field="heart"]', heart);
      put('[data-field="quality"]', quality);
      put('[data-field="kills"]', `${kills} ${kills === 1 ? 'shopper' : 'shoppers'}`);
      put('[data-field="round"]', `Round ${round}`);
      put('.certificate-remark', remark);
      put('.certificate-note', note);
      element.querySelector('.certificate-note').hidden = !note;
      element.hidden = false;
      clearTimeout(timer);
      if (autoHide) timer = setTimeout(hide, ui.certificateSeconds * 1000);
    },
  };
}

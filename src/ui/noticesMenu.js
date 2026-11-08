import { createModal } from './modal.js';
import { createBirthCertificate } from './birthCertificate.js';

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

export function createNoticesMenu(history) {
  const root = el('div', 'settings hidden');
  const card = el('div', 'settings-card notices-card');
  const content = el('div', 'notices-content');
  content.tabIndex = 0;
  content.setAttribute('aria-label', 'Recent PA messages and certificates, newest first');
  const footer = el('div', 'settings-footer');
  const back = el('button', 'play', 'Back');
  back.type = 'button';
  footer.append(el('span', 'settings-hint', 'Controller: D-pad to scroll · A / B back'), back);
  card.append(el('div', 'form-number', 'SG / PERSONNEL · SHIFT CORRESPONDENCE'), el('h2', 'settings-title', 'Notices & certificates'), content, footer);
  root.append(card);
  root.setAttribute('aria-label', 'Notices and certificates');
  document.body.append(root);
  const modal = createModal(root, () => modal.close());
  back.addEventListener('click', () => modal.close());

  return {
    get isOpen() { return !root.classList.contains('hidden'); },
    open() {
      const { messages, certificates } = history.snapshot();
      content.replaceChildren();
      if (!messages.length && !certificates.length) content.append(el('p', 'notices-empty', 'Nothing filed this shift yet. PA messages and Build-A-Blaster certificates will appear here.'));
      if (certificates.length) {
        content.append(el('h3', 'notices-heading', 'Birth certificates'));
        for (const fields of certificates) {
          const certificate = createBirthCertificate({ autoHide: false });
          certificate.show(fields);
          content.append(certificate.element);
        }
      }
      if (messages.length) {
        content.append(el('h3', 'notices-heading', 'Public address'));
        for (const message of messages) {
          const entry = el('article', 'notice-entry');
          entry.append(el('h4', null, message.kicker), el('p', null, message.text));
          content.append(entry);
        }
      }
      content.scrollTop = 0;
      modal.open();
    },
    close: () => modal.close(),
    padNav(input) {
      if (['PadA', 'PadB', 'PadStart'].some(key => input.consumePress(key))) return modal.close();
      const step = (input.consumePress('PadDown') ? 1 : 0) - (input.consumePress('PadUp') ? 1 : 0);
      if (step) content.scrollBy({ top: step * content.clientHeight * .6, behavior: 'instant' });
    },
  };
}

import { ui } from '../config/ui.js';

// Run-local paperwork. Retain queued/preempted instructions as well as messages
// that reached the intercom; pausing hides the intercom but never clears this file.
export function createNoticeHistory() {
  let messages = [], certificates = [];
  return {
    addMessage({ kicker = 'Galleria public address', text }) {
      if (!text || messages.at(-1)?.text === text) return;
      messages.push({ kicker, text });
      messages = messages.slice(-ui.noticeHistorySize);
    },
    addCertificate(fields) {
      certificates.push({ ...fields });
      certificates = certificates.slice(-ui.certificateHistorySize);
    },
    snapshot: () => ({ messages: messages.map(m => ({ ...m })).reverse(), certificates: certificates.map(c => ({ ...c })).reverse() }),
    clear() { messages = []; certificates = []; },
  };
}

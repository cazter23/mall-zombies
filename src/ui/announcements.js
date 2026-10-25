import { ui } from '../config/ui.js';

// One PA message at a time. Important messages preempt routine copy; a short
// bounded queue keeps same-tick introductions/pickups from overwriting each other.
export function createAnnouncements({ show, hide, schedule = setTimeout, cancel = clearTimeout }) {
  let current = null;
  let timer = null;
  let queue = [];
  function start(message) {
    current = message;
    show(message);
    timer = schedule(() => {
      timer = null;
      current = null;
      if (queue.length) start(queue.shift()); else hide();
    }, ui.announcementSeconds * 1000);
  }
  return {
    push(message) {
      const next = { priority: 0, ...message };
      if (!current) return start(next);
      if (next.text === current.text || queue.some((m) => m.text === next.text)) return;
      if (next.priority > current.priority) {
        cancel(timer);
        start(next);
        return;
      }
      queue.push(next);
      queue.sort((a, b) => b.priority - a.priority);
      queue = queue.slice(0, ui.announcementQueueSize);
    },
    clear() {
      if (timer !== null) cancel(timer);
      timer = null; current = null; queue = [];
      hide();
    },
  };
}

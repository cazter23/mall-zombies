import { ui } from '../config/ui.js';

export function announcementSeconds(message) {
  const words = String(message.text ?? '').trim().split(/\s+/).filter(Boolean).length;
  return Math.min(ui.announcementMaxSeconds, Math.max(ui.announcementSeconds, 1 + words / ui.announcementWordsPerSecond));
}

// One PA message at a time. Important messages preempt routine copy; a short
// bounded queue keeps same-tick introductions/pickups from overwriting each other.
// A message flagged `keep` (the closing checklist's line-opening and line-complete lines: config/closingTime.js) is
// never lost: it does not count against the queue's size, it is never trimmed from it, and if a more important
// message cuts it off while it is showing, it goes back to the head of the queue. Messages without the flag queue,
// trim and preempt exactly as before.
// A message flagged `ifQuiet` (an area's welcome when its door is bought: config/shutters.js) never stacks: if anything
// is showing or waiting, it is dropped and push() returns false. Otherwise push() returns true.
export function createAnnouncements({ show, hide, schedule = setTimeout, cancel = clearTimeout }) {
  let current = null;
  let timer = null;
  let queue = [];
  function start(message) {
    current = message;
    const seconds = announcementSeconds(message);
    show(message, seconds);
    timer = schedule(() => {
      timer = null;
      current = null;
      if (queue.length) start(queue.shift()); else hide();
    }, seconds * 1000);
  }
  return {
    push(message) {
      const next = { priority: 0, ...message };
      if (!current) { start(next); return true; }
      if (next.ifQuiet) return false;
      if (next.text === current.text || queue.some((m) => m.text === next.text)) return true;
      if (next.priority > current.priority) {
        cancel(timer);
        if (current.keep) queue.unshift(current); // cut off mid-read: it is shown again afterwards
        start(next);
        return true;
      }
      queue.push(next);
      queue.sort((a, b) => b.priority - a.priority);
      let room = ui.announcementQueueSize; // (for the messages that are not kept)
      queue = queue.filter((message) => message.keep || room-- > 0);
      return true;
    },
    clear() {
      if (timer !== null) cancel(timer);
      timer = null; current = null; queue = [];
      hide();
    },
  };
}

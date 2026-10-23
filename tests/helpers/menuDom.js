// Minimal DOM for menu logic tests. Native keyboard activation/inert behavior is also
// checked in a real browser; this stand-in only supplies the DOM API the menus use.
export function menuDom() {
  class Node extends EventTarget {
    constructor(tag) {
      super();
      this.tagName = tag.toUpperCase();
      this.children = [];
      this.parentElement = null;
      this.className = '';
      this.attributes = new Map();
      this.inert = false;
      this.hidden = false;
      this.disabled = false;
      this.tabIndex = ['BUTTON', 'INPUT', 'SELECT'].includes(this.tagName) ? 0 : -1;
      this.classList = {
        contains: (name) => this.className.split(' ').includes(name),
        add: (...names) => names.forEach((name) => this.classList.toggle(name, true)),
        remove: (...names) => names.forEach((name) => this.classList.toggle(name, false)),
        toggle: (name, on = !this.classList.contains(name)) => {
          const names = new Set(this.className.split(' ').filter(Boolean));
          if (on) names.add(name); else names.delete(name);
          this.className = [...names].join(' ');
          return on;
        },
      };
    }
    append(...nodes) {
      for (const node of nodes) { this.children.push(node); node.parentElement = this; }
    }
    replaceChildren(...nodes) {
      for (const child of this.children) child.parentElement = null;
      this.children = [];
      this.append(...nodes);
    }
    set textContent(text) { this.replaceChildren(); this.text = text; }
    get textContent() { return String(this.text ?? '') + this.children.map((node) => node.textContent).join(''); }
    setAttribute(key, value) { this.attributes.set(key, String(value)); }
    getAttribute(key) { return this.attributes.get(key) ?? null; }
    matches(selector) {
      return selector.split(',').some((part) => {
        const s = part.trim();
        if (s === '[inert]') return this.inert;
        if (s === '[tabindex]') return this.attributes.has('tabindex');
        if (s.startsWith('.')) return this.classList.contains(s.slice(1));
        return this.tagName === s.toUpperCase();
      });
    }
    closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) ?? null; }
    contains(node) { return node === this || this.children.some((child) => child.contains(node)); }
    querySelectorAll(selector) {
      return this.children.flatMap((child) => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
    get isConnected() { return document.body.contains(this); }
    getClientRects() {
      for (let node = this; node; node = node.parentElement) if (node.hidden || node.classList.contains('hidden')) return [];
      return [{}];
    }
    focus() {
      if (this.closest('[inert]')) return;
      document.activeElement = this;
      const event = new Event('focusin');
      Object.defineProperty(event, 'target', { value: this });
      document.dispatchEvent(event);
    }
    click() { if (!this.closest('[inert]')) this.dispatchEvent(new Event('click')); }
    scrollIntoView() {}
  }
  const document = new EventTarget();
  document.createElement = (tag) => new Node(tag);
  document.body = new Node('body');
  document.activeElement = document.body;
  const window = new EventTarget();
  Object.assign(window, { devicePixelRatio: 1, innerWidth: 1280, innerHeight: 720 });
  globalThis.document = document;
  globalThis.window = window;
  return {
    document, window,
    key(code, shiftKey = false) {
      const event = new Event('keydown', { cancelable: true });
      Object.assign(event, { code, shiftKey });
      document.dispatchEvent(event);
      return event;
    },
  };
}

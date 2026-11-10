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
      this.dataset = {};
      this.inert = false;
      this.hidden = false;
      this.disabled = false;
      this.tabIndex = ['BUTTON', 'INPUT', 'SELECT'].includes(this.tagName) ? 0 : -1;
      this.style = {
        setProperty: (k, v) => { this.style[k] = String(v); },
        getPropertyValue: (k) => this.style[k] ?? '',
        removeProperty: (k) => { delete this.style[k]; },
      };
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
    remove() {
      if (this.parentElement) {
        const idx = this.parentElement.children.indexOf(this);
        if (idx !== -1) this.parentElement.children.splice(idx, 1);
        this.parentElement = null;
      }
    }
    set textContent(text) { this.replaceChildren(); this.text = text; }
    get textContent() { return String(this.text ?? '') + this.children.map((node) => node.textContent).join(''); }
    set innerHTML(html) {
      this.replaceChildren();
      const tokens = html.matchAll(/<(\/?[a-zA-Z0-9]+)([^>]*)>|([^<]+)/g);
      const stack = [this];
      const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
      for (const match of tokens) {
        if (match[3]) {
          const text = match[3].trim();
          if (text) {
            stack[stack.length - 1].text = (stack[stack.length - 1].text ?? '') + text;
          }
          continue;
        }
        const tag = match[1];
        const rest = match[2] ?? '';
        const lower = tag.toLowerCase();
        if (tag.startsWith('/')) {
          const closeTag = lower.slice(1);
          if (stack.length > 1 && stack[stack.length - 1].tagName.toLowerCase() === closeTag) {
            stack.pop();
          }
        } else {
          const child = new Node(tag);
          const classMatch = rest.match(/class=["']([^"']+)["']/);
          if (classMatch) child.className = classMatch[1];
          const attrMatches = rest.matchAll(/([a-zA-Z0-9_-]+)=["']([^"']+)["']/g);
          for (const attr of attrMatches) child.setAttribute(attr[1], attr[2]);
          stack[stack.length - 1].append(child);
          if (!voidTags.has(lower) && !rest.trim().endsWith('/')) {
            stack.push(child);
          }
        }
      }
    }
    setAttribute(key, value) {
      this.attributes.set(key, String(value));
      if (key.startsWith('data-')) {
        const prop = key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        this.dataset[prop] = String(value);
      }
    }
    getAttribute(key) { return this.attributes.get(key) ?? null; }
    matches(selector) {
      return selector.split(',').some((part) => {
        const s = part.trim();
        if (s === '[inert]') return this.inert;
        if (s.startsWith('[') && s.endsWith(']')) {
          const [attr, val] = s.slice(1, -1).split('=');
          const cleanVal = val?.replace(/['"]/g, '');
          return cleanVal !== undefined ? this.getAttribute(attr) === cleanVal : this.attributes.has(attr);
        }
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
  const dummyCtx = new Proxy({}, {
    get: (target, key) => (key in target ? target[key] : (target[key] = () => dummyCtx)),
    set: (target, key, value) => { target[key] = value; return true; },
  });
  document.createElement = (tag) => {
    const node = new Node(tag);
    if (tag.toLowerCase() === 'canvas') {
      node.width = 0;
      node.height = 0;
      node.getContext = () => dummyCtx;
    }
    return node;
  };
  document.body = new Node('body');
  document.activeElement = document.body;
  document.querySelector = (s) => document.body.querySelector(s);
  document.querySelectorAll = (s) => document.body.querySelectorAll(s);
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

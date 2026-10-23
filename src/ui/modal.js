// Settings/Controls sit above another menu. Inert siblings prevent clicks and keyboard
// activation behind the dialog; the focus trap also handles Tab wrapping and scripted focus.
export function createModal(root, onClose) {
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.tabIndex = -1;
  let previousFocus = null;
  let blocked = null;
  const controls = () => [...root.querySelectorAll('button, input, select, [tabindex]')]
    .filter((node) => !node.disabled && node.tabIndex >= 0 && node.getClientRects().length);
  const focusFirst = () => (controls()[0] ?? root).focus();

  function keydown(event) {
    if (event.code === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    } else if (event.code === 'Tab') {
      const nodes = controls();
      const i = nodes.indexOf(document.activeElement);
      event.preventDefault();
      const next = i < 0 ? (event.shiftKey ? nodes.length - 1 : 0)
        : (i + (event.shiftKey ? -1 : 1) + nodes.length) % nodes.length;
      (nodes[next] ?? root).focus();
    }
  }
  function focusin(event) {
    if (!root.contains(event.target)) focusFirst();
  }

  return {
    open() {
      if (blocked) return;
      previousFocus = document.activeElement;
      root.classList.remove('hidden');
      blocked = [...document.body.children].filter((node) => node !== root)
        .map((node) => [node, node.inert]);
      for (const [node] of blocked) node.inert = true;
      document.addEventListener('keydown', keydown, { capture: true });
      document.addEventListener('focusin', focusin, { capture: true });
      focusFirst();
    },
    close() {
      if (!blocked) return;
      document.removeEventListener('keydown', keydown, { capture: true });
      document.removeEventListener('focusin', focusin, { capture: true });
      root.classList.add('hidden');
      for (const [node, inert] of blocked) node.inert = inert;
      blocked = null;
      if (previousFocus?.isConnected && !previousFocus.closest('[inert], .hidden')) previousFocus.focus();
    },
  };
}

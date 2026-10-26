// Progressive enhancement: content and controls never depend on animation.
const active = new Map();
const preference = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
preference?.addEventListener('change', () => {
  if (preference.matches) {
    for (const animation of active.values()) animation.cancel();
    active.clear();
  }
});

export function animateElement(node, frames, options = {}) {
  if (!node?.animate || preference?.matches) return;
  active.get(node)?.cancel();
  const animation = node.animate(frames, {
    duration: 340,
    easing: 'cubic-bezier(.22, 1, .36, 1)',
    ...options,
  });
  active.set(node, animation);
  const clear = () => {
    if (active.get(node) === animation) active.delete(node);
  };
  animation.addEventListener('finish', clear, { once: true });
  animation.addEventListener('cancel', clear, { once: true });
  return animation;
}

export function revealElements(nodes) {
  if (preference?.matches || !globalThis.IntersectionObserver) return () => {};
  const observer = new IntersectionObserver(
    (entries) => {
      let index = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        if (!entry.target.isConnected) continue;
        animateElement(
          entry.target,
          [
            { opacity: 0, transform: 'translateY(18px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          {
            duration: 460,
            delay: Math.min(index++, 3) * 45,
            fill: 'backwards',
          },
        );
      }
    },
    { threshold: 0.08 },
  );
  nodes.forEach((node) => observer.observe(node));
  return () => {
    observer.disconnect();
    nodes.forEach((node) => {
      active.get(node)?.cancel();
      active.delete(node);
    });
  };
}

export function pulse(node) {
  return animateElement(
    node,
    [
      { transform: 'scale(1)' },
      { transform: 'scale(1.14)', offset: 0.4 },
      { transform: 'scale(1)' },
    ],
    { duration: 300 },
  );
}

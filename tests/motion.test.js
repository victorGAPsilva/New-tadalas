import test from 'node:test';
import assert from 'node:assert/strict';

test('movimento reduzido interrompe efeitos e preserva callbacks de encerramento', async (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'matchMedia');
  const preference = new EventTarget();
  preference.matches = false;
  globalThis.matchMedia = () => preference;
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'matchMedia', previous);
    else delete globalThis.matchMedia;
  });
  const { animateElement, pulse } =
    await import('../public/js/motion.js?test=preference');
  let calls = 0,
    cancellations = 0;
  const node = {
    animate() {
      calls++;
      const animation = new EventTarget();
      animation.cancel = () => {
        cancellations++;
        animation.dispatchEvent(new Event('cancel'));
      };
      return animation;
    },
  };
  const first = pulse(node);
  let closed = false;
  first.addEventListener('cancel', () => {
    closed = true;
  });
  preference.matches = true;
  preference.dispatchEvent(new Event('change'));
  assert.equal(closed, true);
  assert.equal(cancellations, 1);
  assert.equal(pulse(node), undefined);
  assert.equal(calls, 1);
  assert.equal(animateElement({}), undefined);
  preference.matches = false;
  pulse(node);
  pulse(node);
  assert.equal(cancellations, 2);
  preference.matches = true;
  preference.dispatchEvent(new Event('change'));
});

test('revelação tolera navegador sem observador e libera elementos removidos pelos filtros', async (t) => {
  const names = ['matchMedia', 'IntersectionObserver'];
  const previous = names.map((name) =>
    Object.getOwnPropertyDescriptor(globalThis, name),
  );
  t.after(() =>
    names.forEach((name, index) => {
      if (previous[index])
        Object.defineProperty(globalThis, name, previous[index]);
      else delete globalThis[name];
    }),
  );
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
  delete globalThis.IntersectionObserver;
  const { revealElements } = await import('../public/js/motion.js?test=reveal');
  assert.doesNotThrow(() => revealElements([{}])());
  let notify,
    disconnected = false,
    played = 0,
    cancelled = 0;
  const observed = new Set();
  globalThis.IntersectionObserver = class {
    constructor(callback) {
      notify = callback;
    }
    observe(node) {
      observed.add(node);
    }
    unobserve(node) {
      observed.delete(node);
    }
    disconnect() {
      disconnected = true;
      observed.clear();
    }
  };
  const node = {
    isConnected: true,
    animate() {
      played++;
      const animation = new EventTarget();
      animation.cancel = () => {
        cancelled++;
      };
      return animation;
    },
  };
  const detached = { ...node, isConnected: false };
  const stop = revealElements([node, detached]);
  notify([
    { target: node, isIntersecting: true },
    { target: detached, isIntersecting: true },
  ]);
  assert.equal(played, 1);
  assert.equal(observed.size, 0);
  stop();
  assert.equal(disconnected, true);
  assert.equal(cancelled, 1);
});

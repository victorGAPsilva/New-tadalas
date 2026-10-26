import './account-status.js';
const toggle = document.querySelector('#menu-toggle');
const navigation = document.querySelector('#navigation');
export function closeMenu() {
  toggle?.setAttribute('aria-expanded', 'false');
  navigation?.classList.remove('open');
}
toggle?.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(open));
  navigation.classList.toggle('open', open);
});
navigation?.addEventListener('click', (event) => {
  if (event.target.closest('a')) closeMenu();
});
document.addEventListener('keydown', (event) => {
  if (
    event.key === 'Escape' &&
    toggle?.getAttribute('aria-expanded') === 'true'
  ) {
    closeMenu();
    toggle.focus();
  }
});
const year = document.querySelector('#year');
if (year) year.textContent = new Date().getFullYear();
if (
  'IntersectionObserver' in window &&
  !matchMedia('(prefers-reduced-motion: reduce)').matches
) {
  document.body.classList.add('motion-ready');
  const observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      }),
    { threshold: 0.08 },
  );
  document
    .querySelectorAll('.reveal')
    .forEach((section) => observer.observe(section));
}

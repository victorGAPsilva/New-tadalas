import { carouselSlides } from './carousel-data.js';
export function initHeroCarousel() {
  const root = document.querySelector('#hero-art');
  if (!root) return () => {};
  const $ = (selector) => root.querySelector(selector);
  const image = $('#carousel-image'),
    previous = $('#carousel-prev'),
    next = $('#carousel-next'),
    pause = $('#carousel-pause'),
    dots = $('#carousel-dots');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let slides = carouselSlides(),
    index = 0,
    playing = !reduced.matches,
    focused = false,
    visible = true,
    timer,
    touch;
  function schedule() {
    clearTimeout(timer);
    if (playing && !focused && visible && !document.hidden && slides.length > 1)
      timer = setTimeout(() => show(index + 1), 4000);
  }
  function show(position, manual = false) {
    index = (position + slides.length) % slides.length;
    const slide = slides[index];
    image.src = slide.image;
    image.alt = `${slide.title}${slide.illustrative ? ' — imagem ilustrativa' : ''}`;
    $('#carousel-title').textContent = slide.title;
    $('#carousel-category').textContent = slide.category;
    $('#carousel-link').href = slide.href;
    $('#carousel-illustrative').hidden = !slide.illustrative;
    $('#carousel-position').textContent =
      `${String(index + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
    $('#carousel-slide').setAttribute(
      'aria-label',
      `${index + 1} de ${slides.length}`,
    );
    [...dots.children].forEach((dot, i) =>
      dot.setAttribute('aria-current', String(i === index)),
    );
    if (manual) {
      $('#carousel-status').textContent =
        `Slide ${index + 1} de ${slides.length}: ${slide.title}`;
    }
    pause.setAttribute(
      'aria-label',
      playing ? 'Pausar carrossel' : 'Retomar carrossel',
    );
    pause.setAttribute('aria-pressed', String(!playing));
    pause.textContent = playing ? 'Ⅱ' : '▷';
    schedule();
  }
  function update(products) {
    slides = carouselSlides(products);
    dots.replaceChildren();
    slides.forEach((slide, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'carousel-dot';
      button.setAttribute(
        'aria-label',
        `Mostrar slide ${i + 1}: ${slide.title}`,
      );
      button.addEventListener('click', () => show(i, true));
      dots.append(button);
    });
    for (const control of [previous, next, pause, dots])
      control.hidden = slides.length < 2;
    show(0);
  }
  previous.addEventListener('click', () => show(index - 1, true));
  next.addEventListener('click', () => show(index + 1, true));
  pause.addEventListener('click', () => {
    playing = !playing;
    show(index);
  });
  root.addEventListener('focusin', (event) => {
    focused = event.target.matches(':focus-visible');
    schedule();
  });
  root.addEventListener('focusout', (event) => {
    if (!root.contains(event.relatedTarget)) {
      focused = false;
      schedule();
    }
  });
  root.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      show(index + (event.key === 'ArrowRight' ? 1 : -1), true);
    }
  });
  $('#carousel-slide').addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch')
      touch = { x: event.clientX, y: event.clientY };
  });
  $('#carousel-slide').addEventListener('pointerup', (event) => {
    if (!touch) return;
    const dx = event.clientX - touch.x,
      dy = event.clientY - touch.y;
    touch = null;
    if (Math.abs(dx) > 50 && Math.abs(dy) < 60)
      show(index + (dx < 0 ? 1 : -1), true);
  });
  $('#carousel-slide').addEventListener('pointercancel', () => {
    touch = null;
  });
  image.addEventListener('error', () => {
    const slide = slides[index];
    if (slide.fallbackImage && !image.src.endsWith(slide.fallbackImage)) {
      image.src = slide.fallbackImage;
      image.alt = `${slide.title} — imagem ilustrativa`;
      $('#carousel-illustrative').hidden = false;
    }
  });
  document.addEventListener('visibilitychange', schedule);
  reduced.addEventListener('change', () => {
    if (reduced.matches) playing = false;
    show(index);
  });
  if ('IntersectionObserver' in window)
    new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting;
        schedule();
      },
      { threshold: 0.2 },
    ).observe(root);
  update([]);
  return update;
}

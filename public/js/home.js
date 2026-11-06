import { initHeroCarousel } from './hero-carousel.js?v=5.0.0';
import './navigation.js';
import { request } from './api.js';
import { renderHomeProducts } from './home-products.js?v=1.0.0';
request('/config/public')
  .then((config) => {
    document.querySelector('#demo-banner').hidden = !config.demoMode;
    const status = document.querySelector('#home-store-status');
    if (status) {
      status.textContent = config.status?.message || '';
      status.classList.toggle('store-closed', config.status?.open === false);
    }
    if (config.logoUrl && /^\/assets\/[a-zA-Z0-9/_.-]+$/.test(config.logoUrl))
      document
        .querySelectorAll('.brand img,.brand-story-mark img')
        .forEach((image) => {
          image.src = config.logoUrl;
          image.alt = config.brand;
        });
    document.querySelectorAll('.whatsapp-link').forEach((link) => {
      link.href = `https://wa.me/${config.whatsappNumber}`;
    });
    const contact = document.querySelector('#contact-number');
    if (contact)
      contact.textContent =
        config.whatsappNumber === '5511960217697'
          ? '+55 11 96021-7697'
          : `+${config.whatsappNumber}`;
    const business = document.querySelector('#business-details');
    const directions = document.querySelector('#home-directions');
    if (config.address && directions) {
      directions.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(config.address)}`;
      directions.hidden = false;
    }
    for (const key of ['address', 'openingHours'])
      if (config[key] && business) {
        const p = document.createElement('p');
        p.textContent = config[key];
        business.append(p);
      }
    if (
      config.instagramUrl &&
      /^https:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9_.]+\/?$/.test(
        config.instagramUrl,
      ) &&
      business
    ) {
      const a = document.createElement('a');
      a.textContent = 'Instagram ↗';
      a.href = config.instagramUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.className = 'text-link';
      business.append(a);
    }
  })
  .catch(() => {
    /* The static page and contact link remain usable offline. */
  });

const updateCarousel = initHeroCarousel();
Promise.all([request('/products'), request('/categories')])
  .then(([products, categories]) => {
    updateCarousel(products);
    renderHomeProducts(products, categories);
  })
  .catch(() => {
    const status = document.querySelector('#home-catalog-status');
    status.querySelector('h3').textContent = 'Seu cardápio está logo ali.';
    status.querySelector('p').textContent =
      'Abra o cardápio para consultar a disponibilidade ou fale com a gente pelo WhatsApp.';
  });

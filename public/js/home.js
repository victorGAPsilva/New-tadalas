import { initHeroCarousel } from './hero-carousel.js?v=4.1.0';
import './navigation.js';
import { request } from './api.js';
request('/config/public')
  .then((config) => {
    const status = document.querySelector('#home-store-status');
    if (status) {
      status.textContent = config.status?.message || '';
      status.classList.toggle('store-closed', config.status?.open === false);
    }
    if (config.logoUrl && /^\/assets\/[a-zA-Z0-9/_.-]+$/.test(config.logoUrl))
      document
        .querySelectorAll('.brand img,.teaser-mark img')
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
request('/products')
  .then(updateCarousel)
  .catch(() => {});

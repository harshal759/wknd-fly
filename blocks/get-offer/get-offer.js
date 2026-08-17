/**
 * Get Offer block – email input and "Get offer" button.
 * If a success toast message is authored, it is shown after the button is clicked.
 */

import { readBlockConfig } from '../../scripts/aem.js';

function showToast(message) {
  const existing = document.querySelector('.get-offer-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'get-offer-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  const icon = document.createElement('span');
  icon.className = 'get-offer-toast-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"
    xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="12" fill="white"/>
    <path d="M6.5 12L10 15.5L17.5 8" stroke="#16a34a" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

  const text = document.createElement('span');
  text.className = 'get-offer-toast-text';
  text.textContent = message;

  toast.append(icon, text);
  document.body.appendChild(toast);

  // Two rAF frames ensure the starting position is painted before transitioning
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('get-offer-toast-visible'));
  });

  setTimeout(() => {
    toast.classList.remove('get-offer-toast-visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 4000);
}

export default async function decorate(block) {
  const config = readBlockConfig(block) || {};
  const rows = [...block.children];
  const placeholder = config.placeholder?.trim() || rows[0]?.textContent?.trim() || 'me@adobetest.com';
  const buttonLabel = config['button-label']?.trim()
    || config.buttonLabel?.trim()
    || rows[1]?.textContent?.trim()
    || 'Get offer';
  const toastMessage = (config['toast-message'] ?? config.toastmessage ?? rows[2]?.textContent ?? '').trim();

  block.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'get-offer-wrapper';

  const input = document.createElement('input');
  input.type = 'text';
  input.name = 'email';
  input.placeholder = placeholder;
  input.className = 'get-offer-input';
  input.setAttribute('aria-label', 'Email address');

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'get-offer-button button';
  button.textContent = buttonLabel;
  if (toastMessage) {
    button.addEventListener('click', () => showToast(toastMessage));
  }

  wrapper.append(input, button);
  block.append(wrapper);
}

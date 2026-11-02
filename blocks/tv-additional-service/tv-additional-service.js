import { readBlockConfig } from '../../scripts/aem.js';
import { normalizeAemPath } from '../../scripts/scripts.js';
import { dispatchCustomEvent } from '../../scripts/custom-events.js';
import { fetchButtonDataSheet } from '../../scripts/form-data-layer.js';

const HEADING_WEIGHT = 'regular';

// Each section is a heading and its options: [data layer path, label]
const SECTIONS = [
  {
    title: 'Upgrade Your Plan',
    options: [
      ['eliteMaxTV', '🌟 Elite Max Package (200+ channels, premium sports) – $15/month'],
      ['entertainmentTV', '🎬 Entertainment+ Package (More movies & lifestyle channels) – $10/month'],
    ],
  },
  {
    title: 'Premium Channels',
    options: [
      ['hboMax', '🍿 HBO Max – $15.99/month'],
      ['showtime', '🔥 Showtime – $10.99/month'],
      ['starz', '🎭 Starz – $9.99/month'],
    ],
  },
  {
    title: 'Sports Add-ons',
    options: [
      ['nfl', '🏈 NFL RedZone – $14.99/month'],
      ['mlb', '⚾ MLB Extra Innings – $129.99/season'],
      ['nba', '🏀 NBA League Pass – $99.99/season'],
    ],
  },
];

const DEFAULTS = {
  submitLabel: 'Add to plan',
  successMessage: 'Thank you! Your selection has been received.',
  eventType: 'tv-additional-service-form-submit',
};

function applyButtonConfigToSubmitButton(block, config) {
  const submitButton = block.querySelector("form button[type='submit']");
  if (!submitButton) return;
  const eventType = config.buttoneventtype ?? config['button-event-type'];
  if (eventType && String(eventType).trim()) submitButton.dataset.buttonEventType = String(eventType).trim();
  const webhookUrl = config.buttonwebhookurl ?? config['button-webhook-url'];
  if (webhookUrl && String(webhookUrl).trim()) submitButton.dataset.buttonWebhookUrl = String(webhookUrl).trim();
  const formId = config.buttonformid ?? config['button-form-id'];
  if (formId && String(formId).trim()) submitButton.dataset.buttonFormId = String(formId).trim();
  const buttonData = config.buttondata ?? config['button-data'];
  if (buttonData && String(buttonData).trim()) submitButton.dataset.buttonData = String(buttonData).trim();
}

function buildFormDef(config) {
  const submitLabel = config['button-label'] || DEFAULTS.submitLabel;

  const items = [];
  const formTitle = String(config['form-title'] ?? '').trim();
  if (formTitle) {
    items.push({
      id: 'heading-tv-additional-service',
      fieldType: 'heading',
      label: { value: formTitle },
      appliedCssClassNames: `col-12 tas-heading tas-heading--${HEADING_WEIGHT}`,
    });
  }
  SECTIONS.forEach((section, index) => {
    items.push({
      id: `heading-tv-additional-service-${index + 1}`,
      fieldType: 'heading',
      label: { value: section.title },
      appliedCssClassNames: `col-12 tas-heading tas-heading--${HEADING_WEIGHT}`,
    });
    section.options.forEach(([path, label]) => {
      items.push({
        id: path,
        name: path,
        fieldType: 'checkbox',
        label: { value: label },
        enum: ['y'],
        type: 'string',
        properties: { variant: 'checkbox', alignment: 'horizontal', colspan: 12 },
        appliedCssClassNames: 'tas-option',
      });
    });
  });
  items.push({
    id: 'submit-btn',
    name: 'submitButton',
    fieldType: 'button',
    buttonType: 'submit',
    label: { value: submitLabel },
    appliedCssClassNames: 'submit-wrapper col-12',
  });

  return {
    id: 'tv-additional-service',
    fieldType: 'form',
    appliedCssClassNames: 'tv-additional-service-form',
    items: [{ id: 'panel-main', name: 'main', fieldType: 'panel', items }],
  };
}

// Every option writes its own path: "y" when ticked, "n" when not (same domain as the app).
function pushSelectionToDataLayer(form) {
  if (typeof window.updateDataLayer !== 'function') return;
  const updates = {};
  SECTIONS.forEach((section) => {
    section.options.forEach(([path]) => {
      const input = form.querySelector(`input[name="${path}"]`);
      updates[path] = input?.checked ? 'y' : 'n';
    });
  });
  window.updateDataLayer(updates);
}

function showSuccessMessage(form, message) {
  form.querySelectorAll('.form-message').forEach((el) => el.remove());
  const msgEl = document.createElement('div');
  msgEl.className = 'form-message success';
  msgEl.textContent = message;
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.parentNode.insertBefore(msgEl, submitBtn);
    submitBtn.disabled = true;
  } else {
    form.appendChild(msgEl);
  }
}

function showToast(message) {
  document.querySelector('.tas-toast')?.remove();
  const toast = document.createElement('div');
  toast.className = 'tas-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('tas-toast--visible'));
  setTimeout(() => {
    toast.classList.remove('tas-toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function attachSubmitHandler(block, config) {
  const form = block.querySelector('form');
  if (!form) return;

  const successMessage = config['success-message'] || DEFAULTS.successMessage;
  const redirectUrl = normalizeAemPath(config['redirect-url'] || config.redirecturl || '');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    pushSelectionToDataLayer(form);

    const submitBtn = form.querySelector("button[type='submit']");
    const buttonDataUrl = submitBtn?.dataset?.buttonData?.trim();
    if (buttonDataUrl && typeof window.updateDataLayer === 'function') {
      const sheetData = await fetchButtonDataSheet(normalizeAemPath(buttonDataUrl));
      if (sheetData) window.updateDataLayer(sheetData);
    }

    dispatchCustomEvent(submitBtn?.dataset?.buttonEventType?.trim() || DEFAULTS.eventType);

    if (redirectUrl) {
      showSuccessMessage(form, successMessage);
      setTimeout(() => { window.location.href = redirectUrl; }, 2000);
    } else {
      showToast(successMessage);
    }
  });
}

export default async function decorate(block) {
  const config = readBlockConfig(block) || {};
  [...block.children].forEach((row) => { row.style.display = 'none'; });

  const formContainer = document.createElement('div');
  formContainer.className = 'form';
  const pre = document.createElement('pre');
  const code = document.createElement('code');
  code.textContent = JSON.stringify(buildFormDef(config));
  pre.append(code);
  formContainer.append(pre);
  block.replaceChildren(formContainer);

  const formModule = await import('../form/form.js');
  await formModule.default(formContainer);

  setTimeout(() => {
    applyButtonConfigToSubmitButton(block, config);
    attachSubmitHandler(block, config);
  }, 100);
}

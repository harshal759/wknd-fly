import { readBlockConfig } from '../../scripts/aem.js';
import { normalizeAemPath } from '../../scripts/scripts.js';
import { dispatchCustomEvent } from '../../scripts/custom-events.js';
import { fetchButtonDataSheet } from '../../scripts/form-data-layer.js';

const HEADING_WEIGHT = 'bold';

// Each section is a heading and its options: [data layer path, label]
const SECTIONS = [
  {
    title: 'Data & Internet Add-Ons',
    options: [
      ['extraData', 'Extra Data - 5GB - $40'],
      ['internationalDataPlans', 'International Data Plans - $10/month'],
      ['mobileHotspots', 'Mobile Hotspot Data Boosts -$35 for 5GB extra data'],
    ],
  },
  {
    title: 'Entertainment & Streaming',
    options: [
      ['appleMusic', 'Apple Music Subscription - $10.99/month'],
      ['disneyHulu', 'Disney+ / Hulu / ESPN+ Bundles - $10.99/month'],
      ['cloudStorage', 'CitiSignal Cloud Storage - 600GB: $6/month'],
      ['gamingPass', 'Gaming Passes or Streaming Services - $10.99/month'],
    ],
  },
  {
    title: 'Device Protection & Security',
    options: [
      ['mobileProtect', 'CitiSignal Mobile Protect (phone insurance & tech support) - $17/month per device'],
      ['smartFamily', 'Smart Family (parental controls & location tracking) - $4.99/month'],
      ['callFilterPlus', 'Call Filter Plus (spam call blocking) - $2.99/month'],
      ['totalMobileProtect', 'Total Mobile Protection (extended warranty & device repair) - $14/month per device'],
    ],
  },
];

const DEFAULTS = {
  submitLabel: 'Buy',
  successMessage: 'Thank you! Your selection has been received.',
  eventType: 'mobile-additional-service-form-submit',
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
      id: 'heading-mobile-additional-service',
      fieldType: 'heading',
      label: { value: formTitle },
      appliedCssClassNames: `col-12 mas-heading mas-heading--${HEADING_WEIGHT}`,
    });
  }
  SECTIONS.forEach((section, index) => {
    items.push({
      id: `heading-mobile-additional-service-${index + 1}`,
      fieldType: 'heading',
      label: { value: section.title },
      appliedCssClassNames: `col-12 mas-heading mas-heading--${HEADING_WEIGHT}`,
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
        appliedCssClassNames: 'mas-option',
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
    id: 'mobile-additional-service',
    fieldType: 'form',
    appliedCssClassNames: 'mobile-additional-service-form',
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
  document.querySelector('.mas-toast')?.remove();
  const toast = document.createElement('div');
  toast.className = 'mas-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('mas-toast--visible'));
  setTimeout(() => {
    toast.classList.remove('mas-toast--visible');
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

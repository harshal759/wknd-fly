import { readBlockConfig } from '../../scripts/aem.js';
import { normalizeAemPath } from '../../scripts/scripts.js';
import { dispatchCustomEvent } from '../../scripts/custom-events.js';
import { fetchButtonDataSheet } from '../../scripts/form-data-layer.js';

const DEFAULTS = {
  submitLabel: 'Create',
  successMessage: 'Thank you! Your automatic payment has been created.',
  eventType: 'automatic-payments-form-submit',
};

// Option values are the ones the existing app already sends, so they are kept as they were.
const PAYMENT_METHODS = [
  ['card', 'Credit/Debit Card'],
  ['bank', 'Bank Account (Direct Debit)'],
  ['paypall', 'PayPal'],
  ['other', 'Other (Please specify)'],
];
const PAYMENT_CYCLES = [
  ['monthly', 'Monthly'],
  ['quaterly', 'Quarterly'],
  ['annualy', 'Annually'],
];

// Field name -> data layer path. The radio paths are the ones the existing app uses.
const TEXT_FIELD_MAP = {
  accountNumber: 'accountNumber',
  fullName: 'person.name.fullName',
  email: 'personalEmail.address',
};
const RADIO_FIELD_MAP = {
  paymentMethod: 'Payment Method',
  paymentCycle: 'Payment Cycle',
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

function radioGroup(id, label, options, selected) {
  return {
    id,
    name: id,
    fieldType: 'radio-group',
    label: { value: label },
    enum: options.map(([value]) => value),
    enumNames: options.map(([, text]) => text),
    value: selected,
    properties: { alignment: 'vertical', colspan: 12 },
    appliedCssClassNames: 'col-12 ap-radio',
  };
}

function buildFormDef(config) {
  const submitLabel = config['button-label'] || DEFAULTS.submitLabel;
  const formTitle = String(config['form-title'] ?? '').trim();
  return {
    id: 'automatic-payments',
    fieldType: 'form',
    appliedCssClassNames: 'automatic-payments-form',
    items: [
      {
        id: 'panel-main',
        name: 'main',
        fieldType: 'panel',
        items: [
          ...(formTitle ? [{
            id: 'heading-automatic-payments',
            fieldType: 'heading',
            label: { value: formTitle },
            appliedCssClassNames: 'col-12',
          }] : []),
          {
            id: 'accountNumber',
            name: 'accountNumber',
            fieldType: 'text-input',
            label: { value: 'Account number' },
            properties: { colspan: 12 },
          },
          {
            id: 'fullName',
            name: 'fullName',
            fieldType: 'text-input',
            label: { value: 'Full Name' },
            properties: { colspan: 12 },
          },
          {
            id: 'email',
            name: 'email',
            fieldType: 'text-input',
            label: { value: 'Email Address' },
            properties: { colspan: 12 },
          },
          radioGroup('paymentMethod', 'Payment Method', PAYMENT_METHODS, PAYMENT_METHODS[0][0]),
          radioGroup('paymentCycle', 'Payment Cycle', PAYMENT_CYCLES, PAYMENT_CYCLES[0][0]),
          {
            id: 'submit-btn',
            name: 'submitButton',
            fieldType: 'button',
            buttonType: 'submit',
            label: { value: submitLabel },
            appliedCssClassNames: 'submit-wrapper col-12',
          },
        ],
      },
    ],
  };
}

function setNestedValue(target, path, value) {
  const parts = path.split('.');
  let current = target;
  parts.forEach((part, i) => {
    if (i === parts.length - 1) {
      current[part] = value;
    } else {
      current[part] = current[part] || {};
      current = current[part];
    }
  });
}

function pushToDataLayer(form) {
  if (typeof window.updateDataLayer !== 'function') return;
  const updates = {};
  Object.entries(TEXT_FIELD_MAP).forEach(([name, path]) => {
    const value = form.querySelector(`[name="${name}"]`)?.value?.trim();
    if (value) setNestedValue(updates, path, value);
  });
  Object.entries(RADIO_FIELD_MAP).forEach(([name, path]) => {
    // The form renderer names each radio "<field>_<field>", so read the checked one in the group.
    const value = form.querySelector(`#${name} input[type="radio"]:checked`)?.value;
    if (value) setNestedValue(updates, path, value);
  });
  if (Object.keys(updates).length) window.updateDataLayer(updates);
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
  document.querySelector('.ap-toast')?.remove();
  const toast = document.createElement('div');
  toast.className = 'ap-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('ap-toast--visible'));
  setTimeout(() => {
    toast.classList.remove('ap-toast--visible');
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
    pushToDataLayer(form);

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

  // Like the existing app, start with the first option of each group selected.
  block.querySelectorAll('.radio-group-wrapper').forEach((group) => {
    const first = group.querySelector('input[type="radio"]');
    if (first && !group.querySelector('input[type="radio"]:checked')) first.checked = true;
  });

  const emailInput = block.querySelector('input[name="email"]');
  if (emailInput) emailInput.type = 'email';
  const accountInput = block.querySelector('input[name="accountNumber"]');
  if (accountInput) accountInput.inputMode = 'decimal';

  setTimeout(() => {
    applyButtonConfigToSubmitButton(block, config);
    attachSubmitHandler(block, config);
  }, 100);
}

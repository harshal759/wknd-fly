import { readBlockConfig } from '../../scripts/aem.js';
import { normalizeAemPath } from '../../scripts/scripts.js';
import { dispatchCustomEvent } from '../../scripts/custom-events.js';
import { fetchButtonDataSheet } from '../../scripts/form-data-layer.js';

const DEFAULT_TIME_SLOTS = ['9 AM', '10 AM', '11 AM', '12 PM'];
const DEFAULT_DAYS_SHOWN = 3;
const DEFAULT_MOBILE_DAYS_SHOWN = 2;
const NAV_ARROW_ICON = `
  <svg viewBox="0 0 36 36" class="sc-slot-picker-nav-icon" focusable="false" aria-hidden="true" role="img">
    <path fill-rule="evenodd" d="M24,18v0a1.988,1.988,0,0,1-.585,1.409l-7.983,7.98a2,2,0,1,1-2.871-2.772l.049-.049L19.181,18l-6.572-6.57a2,2,0,0,1,2.773-2.87l.049.049,7.983,7.98A1.988,1.988,0,0,1,24,18Z"></path>
  </svg>
`;

const SHORT_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SHORT_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DEFAULTS = {
  buttonLabel: 'Schedule Call',
  successMessage: 'Thank you! Your consultation has been scheduled. We will confirm shortly.',
  dataLayerKey: 'consultation',
};

function isTruthy(value) {
  return value === true || String(value || '').trim().toLowerCase() === 'true';
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

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
  const formTitle = String(config['form-title'] ?? '').trim();
  const buttonLabel = config['button-label'] || DEFAULTS.buttonLabel;

  return {
    id: 'schedule-consultation',
    fieldType: 'form',
    appliedCssClassNames: 'schedule-consultation-form',
    items: [
      // The heading is omitted entirely when no title is authored, rather than falling back to a
      // default: an unauthored field means the author wants no title, not a generic one.
      ...(formTitle ? [{
        id: 'heading-schedule-consultation',
        fieldType: 'heading',
        label: { value: formTitle },
        appliedCssClassNames: 'col-12 sc-form-title',
      }] : []),
      {
        id: 'panel-main',
        name: 'main',
        fieldType: 'panel',
        items: [
          {
            id: 'submit-btn',
            name: 'submitButton',
            fieldType: 'button',
            buttonType: 'submit',
            label: { value: buttonLabel },
            appliedCssClassNames: 'submit-wrapper col-12',
          },
        ],
      },
    ],
  };
}

// ── TimeSlotPicker ────────────────────────────────────────────────────────────

function buildTimeSlotPicker(config = {}, dataLayerKey, slotLabel) {
  const rawSlots = config['time-slots'] || '';
  const dailyOptions = rawSlots
    ? rawSlots.split(',').map((s) => s.trim()).filter(Boolean)
    : DEFAULT_TIME_SLOTS;
  let daysShown = parseInt(config['days-shown'], 10) || DEFAULT_DAYS_SHOWN;
  const mobileDaysShown = parseInt(config['mobile-days-shown'], 10) || DEFAULT_MOBILE_DAYS_SHOWN;
  if (window.matchMedia('(width <= 480px)').matches) daysShown = mobileDaysShown;
  const multiple = isTruthy(config['multiple-slots']);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let dateOffset = 0;
  let selection = multiple ? [] : null;
  const slotData = {};

  const wrapper = document.createElement('div');
  wrapper.className = 'sc-slot-picker';

  // An unauthored label means the author wants none, not a generic one - the same
  // rule the form title follows. Without this the picker always carried a caption,
  // which read as a duplicate heading whenever the form title said the same thing.
  const label = String(slotLabel ?? '').trim();
  let labelEl = null;
  if (label) {
    labelEl = document.createElement('p');
    labelEl.className = 'sc-slot-picker__label';
    labelEl.textContent = label;
  }

  const content = document.createElement('div');
  content.className = 'sc-slot-picker__content';

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'sc-slot-picker__nav sc-slot-picker-nav-prev';
  prevBtn.setAttribute('aria-label', 'Previous days');
  prevBtn.innerHTML = NAV_ARROW_ICON;

  const columnsEl = document.createElement('div');
  columnsEl.className = 'sc-slot-picker__columns';

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'sc-slot-picker__nav';
  nextBtn.setAttribute('aria-label', 'Next days');
  nextBtn.innerHTML = NAV_ARROW_ICON;

  content.append(prevBtn, columnsEl, nextBtn);
  wrapper.append(...(labelEl ? [labelEl] : []), content);

  function isSelected(val) {
    return multiple ? selection.includes(val) : selection === val;
  }

  function getOrCreateDayData(date) {
    const key = date.toDateString();
    if (!slotData[key]) {
      slotData[key] = {
        key,
        dayName: SHORT_DAY_NAMES[date.getDay()],
        day: date.getDate(),
        monthName: SHORT_MONTH_NAMES[date.getMonth()],
        options: dailyOptions.map((opt) => ({
          value: `${key} - ${opt}`,
          label: opt,
          disabled: Math.random() > 0.7,
        })),
      };
    }
    return slotData[key];
  }

  function pushAppointmentDataLayer(val) {
    if (typeof window.updateDataLayer !== 'function') return;
    window.updateDataLayer({
      interactionDetails: {
        financial: {
          [dataLayerKey]: {
            dateTime: Array.isArray(val) ? val.join('; ') : val || '',
          },
        },
      },
    });
  }

  function selectSlot(val) {
    if (multiple) {
      selection = selection.includes(val)
        ? selection.filter((v) => v !== val)
        : [...selection, val];
    } else {
      selection = val;
    }
    pushAppointmentDataLayer(selection);
    render();
  }

  function render() {
    columnsEl.innerHTML = '';
    for (let i = 0; i < daysShown; i++) {
      const date = addDays(today, dateOffset + i);
      const col = getOrCreateDayData(date);

      const colEl = document.createElement('div');
      colEl.className = 'sc-slot-picker__column';

      const header = document.createElement('div');
      header.className = 'sc-slot-picker__col-header';
      header.innerHTML = `<strong>${col.dayName}</strong><em>${col.day} ${col.monthName}</em>`;
      colEl.append(header);

      col.options.forEach((opt) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = opt.label;
        btn.className = 'sc-slot-picker__option'
          + (opt.disabled ? ' is-disabled' : '')
          + (isSelected(opt.value) ? ' is-selected' : '');
        if (!opt.disabled) btn.addEventListener('click', () => selectSlot(opt.value));
        colEl.append(btn);
      });

      columnsEl.append(colEl);
    }
    prevBtn.disabled = dateOffset <= 0;
  }

  prevBtn.addEventListener('click', () => { dateOffset = Math.max(0, dateOffset - daysShown); render(); });
  nextBtn.addEventListener('click', () => { dateOffset += daysShown; render(); });

  render();

  wrapper.getSelection = () => (Array.isArray(selection) ? selection.join('; ') : selection || '');

  return wrapper;
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
  const existing = document.querySelector('.sc-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'sc-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('sc-toast--visible'));

  setTimeout(() => {
    toast.classList.remove('sc-toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function attachSubmitHandler(block, config, slotPicker) {
  const form = block.querySelector('form');
  if (!form) return;

  const successMessage = config['success-message'] || DEFAULTS.successMessage;
  const redirectUrl = normalizeAemPath(config['redirect-url'] || config.redirecturl || '');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const selectedSlot = slotPicker.getSelection();
    const existingErr = block.querySelector('.sc-slot-error');
    if (!selectedSlot) {
      if (!existingErr) {
        const err = document.createElement('p');
        err.className = 'sc-slot-error';
        err.textContent = 'Please select an available day and time.';
        slotPicker.after(err);
      }
      return;
    }
    block.querySelector('.sc-slot-error')?.remove();

    if (typeof window.updateDataLayer === 'function') {
      window.updateDataLayer({
        interactionDetails: {
          financial: {
            [DEFAULTS.dataLayerKey]: {
              dateTime: selectedSlot,
            },
          },
        },
      });
    }

    const submitBtn = form.querySelector("button[type='submit']");

    const buttonDataUrl = submitBtn?.dataset?.buttonData?.trim();
    if (buttonDataUrl && typeof window.updateDataLayer === 'function') {
      const sheetData = await fetchButtonDataSheet(normalizeAemPath(buttonDataUrl));
      if (sheetData) window.updateDataLayer(sheetData);
    }

    const eventType = submitBtn?.dataset?.buttonEventType?.trim();
    if (eventType) dispatchCustomEvent(eventType);

    if (redirectUrl) {
      showSuccessMessage(form, successMessage);
      setTimeout(() => { window.location.href = redirectUrl; }, 2000);
    } else {
      showToast(successMessage);
    }
  });
}

// ── decorate ──────────────────────────────────────────────────────────────────

export default async function decorate(block) {
  const config = readBlockConfig(block) || {};
  [...block.children].forEach((row) => { row.style.display = 'none'; });

  const formDef = buildFormDef(config);
  const formContainer = document.createElement('div');
  formContainer.className = 'form';

  const pre = document.createElement('pre');
  const code = document.createElement('code');
  code.textContent = JSON.stringify(formDef);
  pre.append(code);
  formContainer.append(pre);

  block.replaceChildren(formContainer);

  const formModule = await import('../form/form.js');
  await formModule.default(formContainer);

  // Inject the slot picker before the submit button
  const slotPicker = buildTimeSlotPicker(config, DEFAULTS.dataLayerKey, config['slots-label']);
  const submitWrapper = block.querySelector('.submit-wrapper');
  if (submitWrapper) {
    submitWrapper.before(slotPicker);
  } else {
    block.append(slotPicker);
  }

  setTimeout(() => {
    applyButtonConfigToSubmitButton(block, config);
    attachSubmitHandler(block, config, slotPicker);
  }, 100);
}

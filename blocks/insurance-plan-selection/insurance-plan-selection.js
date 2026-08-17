import { readBlockConfig } from "../../scripts/aem.js";
import { normalizeAemPath } from "../../scripts/scripts.js";
import { dispatchCustomEvent } from "../../scripts/custom-events.js";
import { submitToWebhook, fetchButtonDataSheet } from "../../scripts/form-data-layer.js";

// ============================================================
//  INSURANCE PLAN WIZARD DEFINITION (3 Steps)
// ============================================================
function buildInsurancePlanDef() {
  const step1 = {
    id: 'step-1-coverage',
    name: 'step1',
    fieldType: 'panel',
    items: [
      { id: 'step-1-title', fieldType: 'heading', label: { value: 'Are you looking for coverage for yourself or your family?' }, appliedCssClassNames: 'wizard-step-title col-12' },
      { id: 'coverageFor', name: 'coverageFor', fieldType: 'radio-group',
        enum: ['myself', 'family'],
        enumNames: ['Myself', 'Family'],
        properties: { alignment: 'vertical', colspan: 12 },
        appliedCssClassNames: 'col-12' 
      }
    ],
  };

  const step2 = {
    id: 'step-2-frequency',
    name: 'step2',
    fieldType: 'panel',
    items: [
      { id: 'step-2-title', fieldType: 'heading', label: { value: 'How often do you get care?' }, appliedCssClassNames: 'wizard-step-title col-12' },
      { id: 'step-2-sub', fieldType: 'heading', label: { value: 'This includes needing coverage for things like ongoing prescriptions, regular lab tests, etc.' }, appliedCssClassNames: 'wizard-step-subtitle col-12' },
      { id: 'careFrequency', name: 'careFrequency', fieldType: 'radio-group',
        enum: ['never', 'rarely', 'sometimes', 'often'],
        enumNames: ['Never', 'Rarely', 'Sometimes', 'Often'],
        properties: { alignment: 'vertical', colspan: 12 },
        appliedCssClassNames: 'col-12' 
      }
    ],
  };

  const step3 = {
    id: 'step-3-preference',
    name: 'step3',
    fieldType: 'panel',
    items: [
      { id: 'step-3-title', fieldType: 'heading', label: { value: 'Would you rather:' }, appliedCssClassNames: 'wizard-step-title col-12' },
      { id: 'costPreference', name: 'costPreference', fieldType: 'radio-group',
        enum: ['lower', 'higher'],
        enumNames: [
          'Pay a lower monthly premium and stay in-network for care', 
          'Pay a higher monthly premium and be able to choose any doctor'
        ],
        properties: { alignment: 'vertical', colspan: 12 },
        appliedCssClassNames: 'col-12' 
      },
      { id: 'submit-btn', name: 'submitButton', fieldType: 'button', buttonType: 'submit', label: { value: 'Submit' }, appliedCssClassNames: 'submit-wrapper col-12' }
    ],
  };

  return {
    id: 'insurance-plan-form',
    fieldType: 'form',
    appliedCssClassNames: 'plan-selection-form is-wizard',
    items: [
      {
        id: 'panel-wizard', name: 'wizard', fieldType: 'panel',
        ':type': 'fd/panel/wizard',
        items: [step1, step2, step3],
      },
    ],
  };
}

// ============================================================
//  SUBMIT BUTTON AUTHORING CONFIG
// ============================================================
function applyButtonConfigToSubmitButton(block, config) {
  const submitButton = block.querySelector("form button[type='submit']");
  if (!submitButton) return;
  const eventType = config.buttoneventtype;
  if (eventType && String(eventType).trim()) submitButton.dataset.buttonEventType = String(eventType).trim();
  const webhookUrl = config.buttonwebhookurl;
  if (webhookUrl && String(webhookUrl).trim()) submitButton.dataset.buttonWebhookUrl = String(webhookUrl).trim();
  const formId = config.buttonformid;
  if (formId && String(formId).trim()) submitButton.dataset.buttonFormId = String(formId).trim();
  const buttonData = config.buttondata;
  if (buttonData && String(buttonData).trim()) submitButton.dataset.buttonData = String(buttonData).trim();
  submitButton.textContent = config.submitbuttontext?.trim() || 'Submit';
}

// ============================================================
//  WIZARD NAVIGATION & STEP INDICATOR
// ============================================================
function setupWizardStepIndicator(block) {
  const wizard = block.querySelector('form .wizard');
  if (!wizard) return;

  const totalSteps = wizard.querySelectorAll('.panel-wrapper').length;
  const btnWrapper = wizard.querySelector('.wizard-button-wrapper');
  if (!btnWrapper || totalSteps === 0) return;

  // Create progress indicator
  const progressWrapper = document.createElement('div');
  progressWrapper.className = 'wizard-progress-wrapper';
  
  const dotsContainer = document.createElement('div');
  dotsContainer.className = 'wizard-dots';

  for (let i = 0; i < totalSteps; i++) {
    const dot = document.createElement('div');
    dot.className = 'wizard-dot';
    dotsContainer.appendChild(dot);
  }

  progressWrapper.appendChild(dotsContainer);

  // Grab the back button to manage its disabled state
  const prevBtn = btnWrapper.querySelector('.wizard-button-prev button');

  const updateWizardUI = () => {
    const current = wizard.querySelector('.current-wizard-step');
    const idx = current ? parseInt(current.dataset.index, 10) : 0;
    
    // 1. Update Dots
    dotsContainer.querySelectorAll('.wizard-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i <= idx);
    });

    // 2. Disable Back button on the first step
    if (prevBtn) {
      prevBtn.disabled = idx === 0;
    }
  };

  updateWizardUI();
  wizard.addEventListener('wizard:navigate', updateWizardUI);

  // Append progress dots to the main header, NOT the buttons wrapper
  const headerDiv = block.querySelector('.plan-selection-header');
  if (headerDiv) {
    headerDiv.appendChild(progressWrapper);
  }

  // Position Submit button cleanly inside the bottom wrapper
  const submitWrapper = wizard.querySelector('.submit-wrapper');
  if (submitWrapper) btnWrapper.appendChild(submitWrapper);
}

// ============================================================
//  SUBMIT HANDLER
// ============================================================
function attachSubmitHandler(block, config) {
  const form = block.querySelector('form');
  if (!form) return;

  const redirectUrl = config.redirecturl || config.redirectUrl;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = {};
    
    form.querySelectorAll('input, select, textarea').forEach((el) => {
      const name = el.getAttribute('name');
      if (name) {
        if (el.type === 'radio' && el.checked) formData[name] = el.value;
        else if (el.type === 'checkbox') formData[name] = el.checked;
        else if (el.type !== 'radio' && el.type !== 'checkbox') formData[name] = el.value;
      }
    });

    try {
      localStorage.setItem("project_plan_selection", JSON.stringify(formData));

      const submitBtn = form.querySelector("button[type='submit']");
      if (submitBtn) {
        submitBtn.disabled = true;
      }

      const buttonDataUrl = submitBtn?.dataset?.buttonData?.trim();
      if (buttonDataUrl && typeof window.updateDataLayer === 'function') {
        const sheetData = await fetchButtonDataSheet(buttonDataUrl);
        if (sheetData) window.updateDataLayer(sheetData);
      }

      const authoredEventType = submitBtn?.dataset?.buttonEventType?.trim();
      if (authoredEventType) dispatchCustomEvent(authoredEventType);

      const webhookUrl = submitBtn?.dataset?.buttonWebhookUrl?.trim();
      const formId = submitBtn?.dataset?.buttonFormId?.trim();
      if (webhookUrl) await submitToWebhook(form, webhookUrl, formId);

      const redirectTo = normalizeAemPath(redirectUrl);
      if (redirectTo) {
        window.location.href = redirectTo;
      } else {
        alert("Success! Form submitted.");
        if (submitBtn) {
          submitBtn.textContent = config.submitbuttontext?.trim() || 'Submit';
          submitBtn.disabled = false;
        }
      }
    } catch (error) {
      console.error("Plan selection submit error:", error);
    }
  });
}

// ============================================================
//  DECORATE
// ============================================================
export default async function decorate(block) {
  const config = readBlockConfig(block) || {};

  [...block.children].forEach((row) => { row.style.display = 'none'; });

  const headingText = config.formHeading || config.formheading || "Which type of health insurance should I get?";
  const subtitleText = config.formSubtitle || config.formsubtitle || "Take our free, short quiz to learn which type of health insurance might be best for you!";
  
  const headerDiv = document.createElement('div');
  headerDiv.className = 'plan-selection-header';
  headerDiv.innerHTML = `
    <h1>${headingText}</h1>
    <p>${subtitleText}</p>
  `;

  const formDef = buildInsurancePlanDef();
  
  const formContainer = document.createElement('div');
  formContainer.className = 'form-container';

  const pre = document.createElement('pre');
  const code = document.createElement('code');
  code.textContent = JSON.stringify(formDef);
  pre.append(code);
  formContainer.append(pre);
  
  // Entirely replace the authored rows with our custom header and the form
  block.replaceChildren(headerDiv, formContainer);

  const formModule = await import('../form/form.js');
  await formModule.default(formContainer);

  setTimeout(() => {
    applyButtonConfigToSubmitButton(block, config);
    setupWizardStepIndicator(block);
    attachSubmitHandler(block, config);
  }, 100);
}

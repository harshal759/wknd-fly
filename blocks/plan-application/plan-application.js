import { readBlockConfig } from "../../scripts/aem.js";
import { dispatchCustomEvent } from "../../scripts/custom-events.js";
import { submitToWebhook, fetchButtonDataSheet } from "../../scripts/form-data-layer.js";

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
  submitButton.textContent = config.submitbuttontext?.trim() || 'Next';
}

// ============================================================
//  PLAN APPLICATION FORM DEFINITION
// ============================================================
function buildPlanApplicationDef(planName) {
  const applicationTitle = `${planName} Application`;

  const step1 = {
    id: 'step-1-personal-details',
    name: 'step1',
    fieldType: 'panel',
    items: [
      { id: 'step-1-title', fieldType: 'heading', label: { value: applicationTitle }, appliedCssClassNames: 'wizard-step-title col-12 mo-1' },
      { id: 'step-1-subtitle', fieldType: 'heading', label: { value: 'Personal Details' }, appliedCssClassNames: 'wizard-step-subtitle col-12 mo-2' },
      
      // Column 1 (Left)
      { id: 'firstName', name: 'firstName', fieldType: 'text-input', label: { value: 'First name' }, placeholder: 'First Name', properties: { colspan: 6 }, appliedCssClassNames: 'col-6 mo-3' },
      // Column 2 (Right)
      { id: 'birthDate', name: 'birthDate', fieldType: 'text-input', label: { value: 'Date of birth' }, placeholder: 'YYYY-MM-DD', properties: { colspan: 6 }, appliedCssClassNames: 'col-6 mo-5' },
      
      // Column 1 (Left)
      { id: 'lastName', name: 'lastName', fieldType: 'text-input', label: { value: 'Last name' }, placeholder: 'Last Name', properties: { colspan: 6 }, appliedCssClassNames: 'col-6 mo-4' },
      // Column 2 (Right)
      { id: 'gender', name: 'gender', fieldType: 'drop-down', label: { value: 'Gender' }, enum: ['female', 'male', 'not_specified', 'non_specific'], enumNames: ['Female', 'Male', 'Not Specified', 'Non-specific'], properties: { colspan: 6 }, appliedCssClassNames: 'col-6 mo-6' },
      
      // Column 1 (Left)
      { id: 'email', name: 'email', fieldType: 'text-input', label: { value: 'Email' }, properties: { colspan: 6 }, appliedCssClassNames: 'col-6 mo-7' },
      // Column 2 (Right)
      { id: 'phoneNumber', name: 'phoneNumber', fieldType: 'text-input', label: { value: 'Mobile phone number' }, properties: { colspan: 6 }, appliedCssClassNames: 'col-6 mo-8' },
      
      // Column 1 (Left)
      { id: 'jointApplicant', name: 'jointApplicant', fieldType: 'radio-group', label: { value: 'Is there a joint applicant?' }, enum: ['yes', 'no'], enumNames: ['Yes', 'No'], properties: { alignment: 'vertical', colspan: 6 }, appliedCssClassNames: 'col-6 radio-group-field mo-9' }
    ],
  };

  const step2 = {
    id: 'step-2-address-identity',
    name: 'step2',
    fieldType: 'panel',
    items: [
      { id: 'step-2-title', fieldType: 'heading', label: { value: applicationTitle }, appliedCssClassNames: 'wizard-step-title col-12 mo-1' },
      
      // Subtitles mapped to 2-column grid
      { id: 'address-heading', fieldType: 'heading', label: { value: 'Address' }, appliedCssClassNames: 'wizard-step-subtitle col-6 mo-2' },
      { id: 'identity-heading', fieldType: 'heading', label: { value: 'Identity' }, appliedCssClassNames: 'wizard-step-subtitle col-6 mo-6' },

      // Column 1 (Left - Address)
      { id: 'address', name: 'address', fieldType: 'text-input', label: { value: 'Street Address' }, placeholder: 'Street and number', properties: { colspan: 6 }, appliedCssClassNames: 'col-6 mo-3' },
      // Column 2 (Right - Identity)
      { id: 'ssn', name: 'ssn', fieldType: 'text-input', label: { value: 'Social Security Number' }, properties: { colspan: 6 }, appliedCssClassNames: 'col-6 mo-7' },

      // Column 1 (Left - Address)
      { id: 'zipCode', name: 'zipCode', fieldType: 'text-input', label: { value: 'Zip code' }, properties: { colspan: 6 }, appliedCssClassNames: 'col-6 mo-4' },
      // Column 2 (Right - Identity)
      { id: 'patientNumber', name: 'patientNumber', fieldType: 'text-input', label: { value: 'Patient number' }, properties: { colspan: 6 }, appliedCssClassNames: 'col-6 mo-8' },

      // Column 1 (Left - Address)
      { id: 'state', name: 'state', fieldType: 'text-input', label: { value: 'State' }, properties: { colspan: 6 }, appliedCssClassNames: 'col-6 mo-5' },

      // Submit Button
      { id: 'submit-btn', name: 'submitButton', fieldType: 'button', buttonType: 'submit', label: { value: 'Next' }, appliedCssClassNames: 'submit-wrapper col-12 mo-9' }
    ],
  };

  return {
    id: 'plan-application-form',
    fieldType: 'form',
    appliedCssClassNames: 'plan-application-form is-wizard',
    items: [
      {
        id: 'panel-wizard', name: 'wizard', fieldType: 'panel',
        ':type': 'fd/panel/wizard',
        items: [step1, step2],
      },
    ],
  };
}

// ============================================================
//  WIZARD STEP INDICATOR
// ============================================================
function setupWizardStepIndicator(block) {
  const wizard = block.querySelector('form .wizard');
  if (!wizard) return;

  // The application form has 2 functional steps + 1 success step = 3 total dots visually
  const totalVisualSteps = 3; 
  const btnWrapper = wizard.querySelector('.wizard-button-wrapper');
  if (!btnWrapper) return;

  const progressWrapper = document.createElement('div');
  progressWrapper.className = 'wizard-progress-wrapper Progress Progress--alignment-center';
  
  const dotsContainer = document.createElement('div');
  dotsContainer.className = 'wizard-dots Progress__dots';

  for (let i = 0; i < totalVisualSteps; i++) {
    const dot = document.createElement('div');
    dot.className = 'wizard-dot Progress__dot';
    dotsContainer.appendChild(dot);
  }

  const progressLabel = document.createElement('div');
  progressLabel.className = 'Progress__label';

  progressWrapper.appendChild(dotsContainer);
  progressWrapper.appendChild(progressLabel);

  const prevBtn = btnWrapper.querySelector('.wizard-button-prev button');

  const updateWizardUI = () => {
    const current = wizard.querySelector('.current-wizard-step');
    const idx = current ? parseInt(current.dataset.index, 10) : 0;
    
    // Update active dots and X/3 label
    dotsContainer.querySelectorAll('.wizard-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i <= idx);
    });
    progressLabel.textContent = `${idx + 1}/3 step`;

    // Disable Back button on step 1
    if (prevBtn) prevBtn.disabled = idx === 0;
  };

  updateWizardUI();
  wizard.addEventListener('wizard:navigate', updateWizardUI);

  // Prepend progress wrapper to the form block
  block.insertBefore(progressWrapper, block.firstChild);

  // Cleanly position submit wrapper
  const submitWrapper = wizard.querySelector('.submit-wrapper');
  if (submitWrapper) btnWrapper.appendChild(submitWrapper);
}

// ============================================================
//  SUBMIT HANDLER (Triggers Step 3 Success UI)
// ============================================================
function attachSubmitHandler(block, planName, config) {
  const form = block.querySelector('form');
  if (!form) return;

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
      localStorage.setItem("project_plan_application", JSON.stringify(formData));

      const submitBtn = form.querySelector("button[type='submit']");

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

      const successMessageHTML = `
        <div class="Progress Progress--alignment-center wizard-progress-wrapper">
            <div class="Progress__dots">
                <div class="Progress__dot active"></div>
                <div class="Progress__dot active"></div>
                <div class="Progress__dot active"></div>
            </div>
            <div class="Progress__label">3/3 step</div>
        </div>
        <div class="Title Title--alignment-center Title--textAlignment-left success-container">
            <div class="Title__content">
                <h1>Congratulations!</h1>
                <div class="Text Text--alignment-left Title__subtitle">
                    <div class="Text__content">
                        <p>You have just enrolled in the <strong>${planName}</strong>.</p><br><br>
                        <p>Your application will be available in your account dashboard and sent to you via email together with your onboarding checklist.</p>
                    </div>
                </div>
            </div>
        </div>
      `;
      block.innerHTML = successMessageHTML;
    } catch (error) {
      console.error("Plan application submit error:", error);
    }
  });
}

// ============================================================
//  DECORATE
// ============================================================
export default async function decorate(block) {
  const config = readBlockConfig(block) || {};
  
  // Extract plan name from URL params, fallback to authored config
  const urlParams = new URLSearchParams(window.location.search);
  const planName = urlParams.get('planName') || urlParams.get('plan') || config.defaultPlanName || config.defaultplanname || 'Medicare Extra (HMO) Plan';

  [...block.children].forEach((row) => { row.style.display = 'none'; });

  const formDef = buildPlanApplicationDef(planName);
  const formContainer = document.createElement('div');
  formContainer.className = 'form-container';

  const pre = document.createElement('pre');
  const code = document.createElement('code');
  code.textContent = JSON.stringify(formDef);
  pre.append(code);
  formContainer.append(pre);
  
  block.replaceChildren(formContainer);

  const formModule = await import('../form/form.js');
  await formModule.default(formContainer);

  setTimeout(() => {
    applyButtonConfigToSubmitButton(block, config);
    setupWizardStepIndicator(block);
    attachSubmitHandler(block, planName, config);
  }, 100);
}
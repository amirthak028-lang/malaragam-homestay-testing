
(() => {
  'use strict';

  const form = document.getElementById('cancellationForm');
  const checkbox = document.getElementById('policyAcknowledged');
  const button = document.getElementById('submitCancellation');
  const message = document.getElementById('cancelMessage');
  const year = document.getElementById('year');

  if (year) year.textContent = new Date().getFullYear();

  if (!form || !checkbox || !button || !message) {
    console.error('Cancellation form elements could not be found.');
    return;
  }

  const config = window.MALARAGAM_CONFIG;

  if (!config?.SUPABASE_URL || !config?.SUPABASE_ANON_KEY) {
    message.textContent = 'Cancellation service configuration is missing. Please contact Malaragam.';
    message.classList.add('is-error');
    return;
  }

  const functionUrl =
    `${config.SUPABASE_URL}/functions/v1/guest-cancellation-request`;

  let submitted = false;

  checkbox.addEventListener('change', () => {
    button.disabled = !checkbox.checked || submitted;
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (submitted) return;

    if (!checkbox.checked) {
      message.textContent = 'Please acknowledge the cancellation policy before submitting.';
      message.classList.add('is-error');
      return;
    }

    const bookingReference =
      document.getElementById('bookingReference').value.trim();

    const email =
      document.getElementById('registeredEmail').value.trim();

    const reason =
      document.getElementById('cancellationReason').value.trim();

    button.disabled = true;
    button.textContent = 'Submitting...';
    message.textContent = '';
    message.classList.remove('is-error', 'is-success');

    try {
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${config.SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          booking_reference: bookingReference,
          email: email,
          reason: reason,
          policy_acknowledged: true
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Unable to submit your request.');
      }

      submitted = true;

      message.textContent =
        `${result.message} ${result.note || ''}`;

      message.classList.add('is-success');
      button.textContent = 'Request Submitted';

    } catch (error) {
      console.error('Cancellation submission error:', error);

      message.textContent =
        error.message || 'Something went wrong. Please try again or contact Malaragam.';

      message.classList.add('is-error');

      button.disabled = !checkbox.checked;
      button.textContent = 'Submit Cancellation Request';
    }
  });
})();

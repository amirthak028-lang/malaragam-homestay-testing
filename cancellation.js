
(() => {
  'use strict';

  // Get form elements
  const form = document.getElementById('cancellationForm');
  const checkbox = document.getElementById('policyAcknowledged');
  const button = document.getElementById('submitCancellation');
  const message = document.getElementById('cancelMessage');
  const year = document.getElementById('year');

  // Update footer year
  if (year) {
    year.textContent = new Date().getFullYear();
  }

  // Check whether all required elements exist
  if (!form || !checkbox || !button || !message) {
    console.error('Cancellation form elements could not be found.');
    return;
  }

  // Read Supabase configuration
  const config = window.MALARAGAM_CONFIG;

  if (!config?.SUPABASE_URL || !config?.SUPABASE_ANON_KEY) {
    message.textContent =
      'Cancellation service configuration is missing. Please contact Malaragam.';

    message.classList.add('is-error');
    return;
  }

  // Supabase Edge Function URL
  const functionUrl =
    `${config.SUPABASE_URL}/functions/v1/guest-cancellation-request`;

  let submitted = false;

  // Initial button state
  button.disabled = !checkbox.checked;

  button.textContent = checkbox.checked
    ? 'Submit Cancellation Request'
    : 'Please acknowledge the policy';

  // Enable or disable button based on policy acknowledgement
  checkbox.addEventListener('change', () => {
    button.disabled = !checkbox.checked || submitted;

    button.textContent = checkbox.checked
      ? 'Submit Cancellation Request'
      : 'Please acknowledge the policy';
  });

  // Handle cancellation form submission
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (submitted) return;

    // Check policy acknowledgement
    if (!checkbox.checked) {
      message.textContent =
        'Please acknowledge the cancellation policy before submitting.';

      message.classList.add('is-error');
      return;
    }

    // Validate required form fields
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    // Read guest details
    const bookingReference =
      document.getElementById('bookingReference').value.trim();

    const email =
      document.getElementById('registeredEmail').value.trim();

    const reason =
      document.getElementById('cancellationReason').value.trim();

    // Disable button while submitting
    button.disabled = true;
    button.textContent = 'Submitting...';

    message.textContent = '';
    message.classList.remove('is-error', 'is-success');

    try {
      // Send request to Supabase Edge Function
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

      // Handle server errors
      if (!response.ok) {
        throw new Error(
          result.error || 'Unable to submit your cancellation request.'
        );
      }

      // Successful submission
      submitted = true;

      message.textContent =
        `${result.message} ${result.note || ''}`;

      message.classList.add('is-success');

      button.textContent = 'Request Submitted';
      button.disabled = true;

    } catch (error) {
      console.error('Cancellation submission error:', error);

      message.textContent =
        error.message ||
        'Something went wrong. Please try again or contact Malaragam.';

      message.classList.add('is-error');

      // Allow the guest to retry
      button.disabled = !checkbox.checked;

      button.textContent = checkbox.checked
        ? 'Submit Cancellation Request'
        : 'Please acknowledge the policy';
    }
  });

})();

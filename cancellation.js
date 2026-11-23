(() => {
  'use strict';
  const form = document.getElementById('cancellationForm');
  const checkbox = document.getElementById('policyAcknowledged');
  const button = document.getElementById('submitCancellation');
  const message = document.getElementById('cancelMessage');
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  // The secure Edge Function is intentionally not called until it has been
  // implemented and deployed. Never insert cancellation requests from the browser.
  checkbox.addEventListener('change', () => {
    button.disabled = true;
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    message.textContent = 'Online cancellation requests are not active yet. Please contact Malaragam by phone, WhatsApp or email.';
    message.classList.add('is-error');
  });
})();

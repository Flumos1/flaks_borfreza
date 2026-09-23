const form = document.getElementById('product-order');

if (form) {
  const fields = form.elements;
  const fieldset = form.querySelector('fieldset');
  const status = document.getElementById('order-status');
  const total = document.getElementById('order-total');
  const button = form.querySelector('button[type="submit"]');
  const submitLabel = button.textContent;
  const money = new Intl.NumberFormat(form.dataset.language === 'ru' ? 'ru-UA' : 'uk-UA', { maximumFractionDigits: 2 });
  let sending = false;
  let completed = false;

  const updateTotal = () => {
    total.textContent = fields.qty.validity.valid ? money.format(Number(fields.qty.value) * Number(form.dataset.price)) : '\u2014';
  };
  fields.qty.addEventListener('input', updateTotal);
  form.addEventListener('input', (event) => event.target.setCustomValidity?.(''));
  document.querySelector('a[href="#checkout"]')?.addEventListener('click', () => {
    if (completed) status.focus();
    else fields.name.focus({ preventScroll: true });
  });
  fieldset.disabled = false;
  updateTotal();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (sending || completed) return;
    for (const name of ['name', 'city', 'address']) {
      fields[name].setCustomValidity(fields[name].value.trim() ? '' : form.dataset.invalid);
    }
    const phone = fields.phone.value.trim();
    const validPhone = /^[+\d\s().-]+$/.test(phone) && /^\d{10,15}$/.test(phone.replace(/\D/g, ''));
    fields.phone.setCustomValidity(validPhone ? '' : form.dataset.invalidPhone);
    if (!form.reportValidity()) return;

    const payload = {
      type: 'order', language: form.dataset.language, company: fields.company.value,
      items: [{ code: form.dataset.code, qty: Number(fields.qty.value) }],
      paymentMethod: fields.paymentMethod.value,
      customer: {
        name: fields.name.value.trim(), phone, email: fields.email.value.trim(),
        city: fields.city.value.trim(), deliveryAddress: fields.address.value.trim(), comment: fields.comment.value.trim(),
      },
    };
    sending = true;
    fieldset.disabled = true;
    button.textContent = form.dataset.sending;
    status.textContent = form.dataset.sending;
    form.setAttribute('aria-busy', 'true');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(form.action, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: controller.signal,
      });
      const result = await response.json();
      completed = response.ok && result.ok === true;
      status.textContent = completed ? form.dataset.success : form.dataset.failure;
    } catch {
      // A lost response does not prove that the server rejected the order.
      status.textContent = form.dataset.uncertain;
    } finally {
      clearTimeout(timeout);
      sending = false;
      fieldset.disabled = completed;
      button.textContent = submitLabel;
      form.removeAttribute('aria-busy');
      status.focus();
    }
  });
}

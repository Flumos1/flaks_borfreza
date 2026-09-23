import { availableQuantity, PAYMENT_METHODS, SHIPPING_NOTICE } from '../src/data/checkout.js';
import { MAX_ORDER_QTY } from '../src/data/constants.js';

const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function checkoutTemplate(product, lang) {
  if (!availableQuantity(product)) return '';
  const ru = lang === 'ru';
  const t = ru ? {
    title: 'Оформление заказа', quantity: 'Количество', name: 'Ваше имя', phone: 'Телефон',
    email: 'Email (необязательно)', city: 'Город', address: 'Новая Почта: отделение или адрес',
    payment: 'Способ оплаты', comment: 'Комментарий (необязательно)', total: 'Сумма товаров',
    submit: 'Подтвердить заказ', sending: 'Отправляем заказ...',
    success: 'Заказ принят. Мы свяжемся с вами для подтверждения доставки и оплаты.',
    failure: 'Заказ не отправлен. Проверьте данные и повторите попытку или позвоните нам.',
    uncertain: 'Не удалось получить подтверждение. Перед повторной отправкой уточните статус заказа по телефону +38 (067) 545-31-15.',
    invalid: 'Проверьте заполнение поля.', invalidPhone: 'Введите телефон: от 10 до 15 цифр.',
    nojs: 'Для отправки заказа включите JavaScript или позвоните +38 (067) 545-31-15.',
    delivery: 'Доставка и оплата', returns: 'Обмен и возврат',
  } : {
    title: 'Оформлення замовлення', quantity: 'Кількість', name: "Ваше ім'я", phone: 'Телефон',
    email: 'Email (необов’язково)', city: 'Місто', address: 'Нова Пошта: відділення або адреса',
    payment: 'Спосіб оплати', comment: 'Коментар (необов’язково)', total: 'Сума товарів',
    submit: 'Підтвердити замовлення', sending: 'Надсилаємо замовлення...',
    success: 'Замовлення прийнято. Ми зв’яжемося з вами для підтвердження доставки та оплати.',
    failure: 'Замовлення не надіслано. Перевірте дані та спробуйте ще раз або зателефонуйте нам.',
    uncertain: 'Не вдалося отримати підтвердження. Перед повторним надсиланням уточніть статус замовлення за телефоном +38 (067) 545-31-15.',
    invalid: 'Перевірте заповнення поля.', invalidPhone: 'Введіть телефон: від 10 до 15 цифр.',
    nojs: 'Для надсилання замовлення увімкніть JavaScript або зателефонуйте +38 (067) 545-31-15.',
    delivery: 'Доставка і оплата', returns: 'Обмін і повернення',
  };
  const input = (key, type, autocomplete, max, required = true) => `<label for="order-${key}">${escape(t[key])}${required ? ' *' : ''}<input id="order-${key}" name="${key}" type="${type}" autocomplete="${autocomplete}" maxlength="${max}" ${required ? 'required' : ''}></label>`;
  return `<section class="section checkout" id="checkout" aria-labelledby="checkout-title">
    <h2 id="checkout-title">${t.title}</h2>
    <p>${escape(ru ? product.name_ru : product.name_ua)} · ${escape(product.code)} · ${product.price} грн / шт</p>
    <form id="product-order" action="/api/order" method="post" data-code="${escape(product.code)}" data-price="${product.price}" data-language="${lang}"
      ${['sending', 'success', 'failure', 'uncertain', 'invalid', 'invalidPhone'].map((key) => `data-${key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}="${escape(t[key])}"`).join(' ')}>
      <fieldset disabled>
        <legend class="sr-only">${t.title}</legend>
        <label class="order-quantity" for="order-qty">${t.quantity}<input id="order-qty" name="qty" type="number" min="1" max="${Math.min(availableQuantity(product), MAX_ORDER_QTY)}" step="1" value="1" required></label>
        <p class="order-total">${t.total}: <output id="order-total" for="order-qty">${product.price}</output> грн</p>
        <p class="order-shipping">${escape(SHIPPING_NOTICE[lang])}</p>
        <div class="order-fields">
          ${input('name', 'text', 'name', 140)}${input('phone', 'tel', 'tel', 80)}
          ${input('email', 'email', 'email', 140, false)}${input('city', 'text', 'address-level2', 140)}
          ${input('address', 'text', 'street-address', 200)}
          <label for="order-payment">${t.payment}<select id="order-payment" name="paymentMethod">${Object.entries(PAYMENT_METHODS).map(([value, labels]) => `<option value="${value}">${escape(labels[lang])}</option>`).join('')}</select></label>
          <label class="order-comment" for="order-comment">${t.comment}<textarea id="order-comment" name="comment" maxlength="1200" rows="3"></textarea></label>
        </div>
        <div hidden aria-hidden="true"><label>Company<input name="company" tabindex="-1" autocomplete="off"></label></div>
        <button class="cta" type="submit">${t.submit}</button>
      </fieldset>
      <p id="order-status" role="status" tabindex="-1" aria-live="polite"></p>
      <noscript><p>${t.nojs}</p></noscript>
    </form>
    <p class="order-links"><a href="/dostavka/?lang=${lang}">${t.delivery}</a> · <a href="/povernennya/?lang=${lang}">${t.returns}</a> · <a href="tel:+380675453115">+38 (067) 545-31-15</a></p>
  </section>`;
}

export const PAYMENT_METHODS = {
  cod: { ua: 'Оплата при отриманні', ru: 'Оплата при получении' },
  invoice: { ua: 'Оплата за рахунком', ru: 'Оплата по счёту' },
};

export const SHIPPING_NOTICE = {
  ua: 'Доставку оплачує покупець за тарифами перевізника. Вартість доставки не входить у суму товарів.',
  ru: 'Доставку оплачивает покупатель по тарифам перевозчика. Стоимость доставки не входит в сумму товаров.',
};

export function validPhone(value) {
  return typeof value === 'string' && /^[+\d\s().-]+$/.test(value)
    && /^\d{10,15}$/.test(value.replace(/\D/g, ''));
}

export function validEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function availableQuantity(product) {
  return Number.isInteger(product?.qty) && product.qty > 0 ? product.qty : 0;
}

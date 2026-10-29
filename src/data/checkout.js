export const PAYMENT_METHODS = {
  cod: { ua: 'Оплата при отриманні', ru: 'Оплата при получении' },
  invoice: { ua: 'Оплата за рахунком', ru: 'Оплата по счёту' },
};

// Nova Poshta parcel up to 2 kg across Ukraine (tariff since 13.04.2026).
// Must equal the flat rate of the "Нова Пошта" rule in Merchant Center.
export const SHIPPING_FROM_UAH = 90;

export const SHIPPING_NOTICE = {
  ua: `Доставка Новою Поштою — від ${SHIPPING_FROM_UAH} грн за тарифами перевізника, оплачує покупець. Вартість доставки не входить у суму товарів.`,
  ru: `Доставка Новой Почтой — от ${SHIPPING_FROM_UAH} грн по тарифам перевозчика, оплачивает покупатель. Стоимость доставки не входит в сумму товаров.`,
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

import { PRODUCTS } from './burr-data.js';
import { MAX_ORDER_QTY } from './constants.js';

export const CART_STORAGE_KEY = 'flaks-cart-v1';
const productsByCode = new Map(PRODUCTS.map((p) => [p.code.toLowerCase(), p]));

export function clampQuantity(value) {
  const qty = Number(value);
  return Number.isFinite(qty) ? Math.min(MAX_ORDER_QTY, Math.max(1, Math.floor(qty))) : 1;
}

// Keep only article codes and quantities in storage, never contact details or prices.
export function restoreCart(raw) {
  try {
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved)) return [];
    const cart = [];
    for (const item of saved) {
      const product = productsByCode.get(String(item?.code || '').toLowerCase());
      if (!product || !Number.isInteger(item.qty) || item.qty < 1) continue;
      const existing = cart.find((p) => p.id === product.id);
      if (existing) existing.qty = clampQuantity(existing.qty + item.qty);
      else cart.push({ ...product, qty: clampQuantity(item.qty) });
    }
    return cart;
  } catch {
    return [];
  }
}

export function addToCart(cart, product) {
  return cart.some((item) => item.id === product.id)
    ? cart.map((item) => item.id === product.id ? { ...item, qty: clampQuantity(item.qty + 1) } : item)
    : [...cart, { ...product, qty: 1 }];
}

export function initialCartState(raw, code) {
  const cart = restoreCart(raw);
  const product = productsByCode.get(String(code || '').toLowerCase());
  return { items: product ? addToCart(cart, product) : cart, open: Boolean(product) };
}

export function serializeCart(cart) {
  return JSON.stringify(cart.map(({ code, qty }) => ({ code, qty })));
}

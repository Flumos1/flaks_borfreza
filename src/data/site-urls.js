export const SITE = 'https://borfrezy.in.ua';

export const SHAPE_SLUGS = {
  A: 'cilindrichna',
  C: 'sferocilindrichna',
  D: 'sferychna',
  E: 'ovalna',
  F: 'giperbolichna',
  G: 'giperbolichna-tochkova',
  H: 'polumyapodibna',
  J: 'konichna-60',
  K: 'konichna-90',
  L: 'sferokonichna',
  M: 'konichna-zagostrena',
  N: 'zvorotniy-konus',
  S: 'konusna-zrizana',
  T: 'diskova',
  U: 'uvignuta-cilindrichna',
  Y: 'diskova-90',
};

export const productSlug = (product) => String(product?.code || `flaks-${product?.id || ''}`).toLowerCase();
export const productPath = (product) => `/borfrezy/${productSlug(product)}/`;
export const productUrl = (product) => `${SITE}${productPath(product)}`;

export const shapePath = (shapeKey) => `/borfrezy/${SHAPE_SLUGS[shapeKey]}/`;
export const shapeUrl = (shapeKey) => `${SITE}${shapePath(shapeKey)}`;

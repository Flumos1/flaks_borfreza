export const SITE = 'https://borfrezy.in.ua';
export const LANGS = ['ua', 'ru'];

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

const normalizeLang = (lang) => (LANGS.includes(lang) ? lang : '');
export const localizedPath = (path, lang = '') => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const cleanLang = normalizeLang(lang);
  return cleanLang ? `/${cleanLang}${cleanPath}` : cleanPath;
};
export const localizedUrl = (path, lang = '') => `${SITE}${localizedPath(path, lang)}`;

export const productSlug = (product) => String(product?.code || `flaks-${product?.id || ''}`).toLowerCase();
export const productPath = (product, lang = '') => localizedPath(`/borfrezy/${productSlug(product)}/`, lang);
export const productUrl = (product, lang = '') => localizedUrl(`/borfrezy/${productSlug(product)}/`, lang);

export const shapePath = (shapeKey, lang = '') => localizedPath(`/borfrezy/${SHAPE_SLUGS[shapeKey]}/`, lang);
export const shapeUrl = (shapeKey, lang = '') => localizedUrl(`/borfrezy/${SHAPE_SLUGS[shapeKey]}/`, lang);

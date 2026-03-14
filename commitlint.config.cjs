/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'auth',
        'users',
        'products',
        'categories',
        'cart',
        'orders',
        'payments',
        'search',
        'notifications',
        'admin',
        'config',
        'deps',
        'ci',
      ],
    ],
  },
};

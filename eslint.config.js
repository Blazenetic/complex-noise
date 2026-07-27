/**
 * Flat ESLint config. Deliberately light: this project has no build step and
 * no framework, so linting is here to catch typos and dead code, not to
 * enforce a house style.
 */

/** Browser globals used by the app. */
const browser = {
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  location: 'readonly',
  localStorage: 'readonly',
  console: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  getComputedStyle: 'readonly',
  performance: 'readonly',
  Event: 'readonly',
  CanvasRenderingContext2D: 'readonly',
  Uint8Array: 'readonly',
  Float32Array: 'readonly',
  OfflineAudioContext: 'readonly',
};

/** Node globals used by the test harness. */
const node = {
  process: 'readonly',
  console: 'readonly',
  URL: 'readonly',
};

const rules = {
  'no-unused-vars': ['error', { args: 'after-used', caughtErrors: 'none' }],
  'no-undef': 'error',
  'no-var': 'error',
  'prefer-const': 'error',
  eqeqeq: ['error', 'smart'],
};

export default [
  {
    files: ['js/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: browser },
    rules,
  },
  {
    // The test harness runs in Node, but its page.evaluate() callbacks are
    // serialised into the browser — so both global sets are legitimate here.
    files: ['tests/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...browser, ...node },
    },
    rules,
  },
];

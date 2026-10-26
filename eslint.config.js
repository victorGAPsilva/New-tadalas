import js from '@eslint/js';
import globals from 'globals';
export default [
  { ignores: ['node_modules/**'] },
  js.configs.recommended,
  { rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } },
  { languageOptions: { globals: { ...globals.node, ...globals.browser } } },
];

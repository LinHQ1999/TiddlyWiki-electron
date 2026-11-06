// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['out/**', 'dist/**', 'build/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // 渲染进程运行在浏览器环境
    files: ['src/renderer/**/*.js'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
  },
  {
    files: ['*.config.js', '*.config.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
      },
    },
  },
);

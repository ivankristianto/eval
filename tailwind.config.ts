import type { Config } from 'tailwindcss';

/**
 * Tailwind CSS v4 Configuration
 *
 * Note: In Tailwind v4, most configuration is done via CSS using @theme directive.
 * This file is for JavaScript-based configuration that can't be done in CSS.
 *
 * See src/styles/theme.css for theme customization using @theme
 */
export default {
  content: [
    './src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}',
  ],
  // Most theme configuration is in src/styles/theme.css using @theme
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;

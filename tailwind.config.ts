import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/renderer/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' }
    },
    extend: {
      colors: {
        'sentinel-bg': '#030712',
        'sentinel-panel': '#111827',
        'sentinel-border': '#1f2937',
        'sentinel-text': '#f9fafb',
        'sentinel-muted': '#6b7280'
      }
    }
  },
  plugins: []
}
export default config

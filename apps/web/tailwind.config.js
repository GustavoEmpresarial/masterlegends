/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        body: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        heading: ['var(--font-heading)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        arcade: ['var(--font-display)', 'system-ui', 'sans-serif'],
        pixel: ['var(--font-pixel)', '"Jersey 15"', '"Press Start 2P"', 'monospace'],
        jersey: ['"Jersey 15"', 'monospace'],
        retro: ['var(--font-pixel)', '"Jersey 15"', 'monospace'],
      },
      colors: {
        background: 'var(--bg-dark)',
        foreground: 'var(--text-primary)',
        primary: {
          DEFAULT: 'var(--green)',
          foreground: 'var(--bg-dark)',
        },
        secondary: {
          DEFAULT: 'var(--bg-light)',
          foreground: 'var(--text-primary)',
        },
        muted: {
          DEFAULT: 'var(--bg-lighter)',
          foreground: 'var(--text-muted)',
        },
        accent: {
          DEFAULT: 'var(--gold)',
          foreground: 'var(--bg-dark)',
        },
        destructive: {
          DEFAULT: 'var(--red)',
          foreground: '#ffffff',
        },
        border: 'var(--bg-lighter)',
        input: 'var(--bg-lighter)',
        ring: 'var(--green)',
      },
      borderRadius: {
        DEFAULT: '0px',
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'blink': 'blink 1s step-end infinite',
        'bounce-pixel': 'bounce-pixel 1s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        'bounce-pixel': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
      },
    },
  },
  plugins: [],
}

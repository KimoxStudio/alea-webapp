import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: 'hsl(var(--background))',
          secondary: 'hsl(var(--background-secondary))',
          surface: 'hsl(var(--background-surface))',
        },
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        gold: {
          50: '#FFF9E6', 100: '#FFF0BF', 200: '#FFE080', 300: '#FFD040',
          400: '#FFBF00', 500: '#C9A84C', 600: '#A07830', 700: '#7A5820',
          800: '#543B10', 900: '#2E1E00',
        },
        emerald: {
          DEFAULT: '#2D8653',
          light: '#3DAA6A',
          dark: '#1E5C39',
        },
        crimson: {
          DEFAULT: '#8B2635',
          light: '#B03344',
          dark: '#5C1A25',
        },
        arcane: {
          DEFAULT: '#4A1C8B',
          light: '#6428B8',
          dark: '#310F5E',
        },
      },
      fontFamily: {
        cinzel: ['Cinzel', 'serif'],
        inter: ['Inter', 'sans-serif'],
        crimson: ['Crimson Text', 'serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        shimmer: { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(100%)' } },
        glow: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.5' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        shimmer: 'shimmer 2s infinite',
        glow: 'glow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
export default config

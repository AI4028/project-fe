const { hairlineWidth } = require('nativewind/theme');
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: Object.fromEntries(
        [
          'border',
          'input',
          'ring',
          'background',
          'foreground',
          'primary',
          'secondary',
          'destructive',
          'muted',
          'accent',
          'popover',
          'card',
        ].map((name) => [
          name,
          ['primary', 'secondary', 'destructive', 'muted', 'accent', 'popover', 'card'].includes(
            name,
          )
            ? { DEFAULT: `hsl(var(--${name}))`, foreground: `hsl(var(--${name}-foreground))` }
            : `hsl(var(--${name}))`,
        ]),
      ),
      borderRadius: { lg: '16px', md: '12px', sm: '8px' },
      borderWidth: { hairline: hairlineWidth() },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

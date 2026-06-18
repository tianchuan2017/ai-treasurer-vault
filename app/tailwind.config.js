/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg:       '#0F172A',
        surface:  '#1E293B',
        surface2: '#263348',
        border:   '#334155',
        indigo:   '#4F46E5',
        'indigo-light': '#6366F1',
        emerald:  '#10B981',
        amber:    '#F59E0B',
        danger:   '#EF4444',
        text:     '#F8FAFC',
        muted:    '#94A3B8',
      },
      fontFamily: {
        serif: ['Georgia', 'Times New Roman', 'serif'],
        mono:  ['"JetBrains Mono"', '"Courier New"', 'monospace'],
      },
    },
  },
  plugins: [],
};

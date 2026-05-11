import { defineConfig, presetUno, presetIcons } from 'unocss';

export default defineConfig({
  presets: [
    presetUno(),
    presetIcons({ scale: 1.2 }),
  ],
  theme: {
    colors: {
      ph: {
        black: '#000',
        surface: '#0d0d0d',
        card: '#111',
        border: '#1a1a1a',
        text: '#fff',
        muted: '#888',
        gold: '#f90',
        'gold-dim': '#cc7a00',
      },
    },
    fontFamily: {
      sans: ['Arial', 'Helvetica', '"Noto Sans SC"', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
    },
  },
  shortcuts: {
    'btn': 'inline-flex items-center justify-center gap-1.5 px-4 py-2 font-bold text-xs uppercase tracking-wider transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none bg-transparent border-none',
    'btn-primary': 'btn bg-ph-gold text-black hover:bg-amber-500 active:scale-95',
    'btn-outline': 'btn border border-ph-border text-ph-muted hover:border-ph-gold/50 hover:text-ph-gold',
    'btn-ghost': 'btn bg-transparent text-ph-muted hover:text-ph-text',
    'btn-punct': 'btn border-0 bg-ph-surface text-ph-text text-xl font-bold min-w-[54px] min-h-[54px] hover:bg-ph-gold/15 hover:text-ph-gold active:scale-90 transition-all duration-100',
    'card': 'bg-ph-surface border-0',
    'card-hover': 'card hover:bg-ph-card transition-colors duration-200',
    'tag': 'inline-flex items-center px-2.5 py-0.5 text-xs font-bold bg-ph-gold/10 text-ph-gold border border-ph-gold/20',
    'input': 'w-full px-3 py-2 bg-ph-black border border-ph-border text-ph-text text-xs placeholder-ph-muted/40 focus:outline-none focus:border-ph-gold/50 transition-colors',
    'container-main': 'max-w-6xl mx-auto px-3 sm:px-4',
  },
});

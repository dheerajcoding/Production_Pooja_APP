/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /* ── Sacred Vermillion / Sindoor primary ─────────────────────────────
           Deeper and richer than generic orange — reads as kumkum/sindoor.
           All existing `primary-*` classes pick this up automatically.       */
        primary: {
          50:  '#fff4ec',
          100: '#ffe5d0',
          200: '#ffc7a0',
          300: '#ffa066',
          400: '#f97638',
          500: '#d9531c',   /* sindoor / kumkum — the signature colour */
          600: '#b83f10',
          700: '#962e09',
          800: '#6f2006',
          900: '#4a1403',
        },

        /* ── Pooja accent palette ──────────────────────────────────────────── */
        kumkum:   '#D9531C',   /* = primary-500  — vermillion sindoor          */
        saffron:  '#F5A623',   /* golden saffron — marigold / turmeric         */
        marigold: '#E8861A',   /* deep marigold — dakshina plate               */
        temple: {
          50:   '#FFF8F0',     /* warm parchment — page / app background        */
          100:  '#FEF0DC',     /* lighter sandalwood card tint                  */
          200:  '#EDD9BC',     /* sandalwood / turmeric border                  */
          300:  '#D4B483',     /* mid-gold — used for accents                   */
          400:  '#B8860B',     /* dark goldenrod — temple gold                  */
          500:  '#8B5E0A',     /* deep temple gold                              */
          900:  '#1C0A00',     /* warm near-black — body text                   */
        },
        maroon: '#800000',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

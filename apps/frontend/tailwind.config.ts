import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          chip: "hsl(var(--accent-chip))",
          "chip-foreground": "hsl(var(--accent-chip-foreground))",
          "chip-border": "hsl(var(--accent-chip-border))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          soft: "hsl(var(--success-soft))",
          "soft-foreground": "hsl(var(--success-soft-foreground))",
          chip: "hsl(var(--success-chip))",
          "chip-foreground": "hsl(var(--success-chip-foreground))",
          "chip-border": "hsl(var(--success-chip-border))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          soft: "hsl(var(--warning-soft))",
          "soft-foreground": "hsl(var(--warning-soft-foreground))",
          chip: "hsl(var(--warning-chip))",
          "chip-foreground": "hsl(var(--warning-chip-foreground))",
          "chip-border": "hsl(var(--warning-chip-border))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
          soft: "hsl(var(--info-soft))",
          "soft-foreground": "hsl(var(--info-soft-foreground))",
          chip: "hsl(var(--info-chip))",
          "chip-foreground": "hsl(var(--info-chip-foreground))",
          "chip-border": "hsl(var(--info-chip-border))",
        },
        rating: "hsl(var(--rating))",
        /* Solo como chip: el calendario es el unico sitio donde se usan. */
        danger: {
          chip: "hsl(var(--danger-chip))",
          "chip-foreground": "hsl(var(--danger-chip-foreground))",
          "chip-border": "hsl(var(--danger-chip-border))",
        },
        neutro: {
          chip: "hsl(var(--neutro-chip))",
          "chip-foreground": "hsl(var(--neutro-chip-foreground))",
          "chip-border": "hsl(var(--neutro-chip-border))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
      },
      /* Todas las formas derivan de `--radius`: sin xl y 2xl, Tailwind los
         servia con sus propios 12 y 16px y el token dejaba de gobernar. */
      borderRadius: {
        sm: "calc(var(--radius) - 4px)",
        md: "calc(var(--radius) - 2px)",
        lg: "var(--radius)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },
      /* Tres niveles con significado: el contenido no pasa de `card`, lo que
         flota usa `raised` y lo que bloquea, `overlay`. */
      boxShadow: {
        /* `flat` y no `card`: `card` ya es un color del tema, y Tailwind
           interpretaria `shadow-card` como color de sombra, no como nivel. */
        flat: "0 1px 2px 0 rgb(2 8 23 / 0.04)",
        raised: "0 4px 12px -2px rgb(2 8 23 / 0.10)",
        overlay: "0 16px 40px -8px rgb(2 8 23 / 0.22)",
      },
      keyframes: {
        "aparecer-fondo": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "aparecer-dialogo": {
          from: {
            opacity: "0",
            transform: "translate(-50%, -46%) scale(0.97)",
          },
          to: { opacity: "1", transform: "translate(-50%, -50%) scale(1)" },
        },
        "aparecer-lista": {
          from: { opacity: "0", transform: "translateY(-4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "aparecer-fondo": "aparecer-fondo 150ms ease-out",
        "aparecer-dialogo":
          "aparecer-dialogo 180ms cubic-bezier(0.16, 1, 0.3, 1)",
        "aparecer-lista": "aparecer-lista 120ms ease-out",
      },
    },
  },
  plugins: [],
};
export default config;

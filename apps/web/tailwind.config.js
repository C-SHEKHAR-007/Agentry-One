/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        success: "hsl(var(--success) / <alpha-value>)",
        warning: "hsl(var(--warning) / <alpha-value>)",
        // Tools, integrations and providers -- the "connect" colour.
        info: "hsl(var(--info) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        chart: {
          1: "hsl(var(--chart-1) / <alpha-value>)",
          2: "hsl(var(--chart-2) / <alpha-value>)",
          3: "hsl(var(--chart-3) / <alpha-value>)",
          4: "hsl(var(--chart-4) / <alpha-value>)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["InterVariable", "Inter", "system-ui", "sans-serif"],
        // IDs, durations, token counts, logs and JSON.
        mono: ["Geist Mono Variable", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(24px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        // Expanding halo behind a live status dot.
        "status-ping": {
          "0%": { transform: "scale(1)", opacity: "0.55" },
          "80%, 100%": { transform: "scale(2.6)", opacity: "0" },
        },
        // Soft breathing glow for running nodes/badges.
        "status-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 hsl(var(--primary) / 0.0)" },
          "50%": { boxShadow: "0 0 0 4px hsl(var(--primary) / 0.14), 0 0 18px hsl(var(--primary) / 0.28)" },
        },
        // Light sweeping along a progress bar / edge.
        sweep: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(250%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        // Modals: rise and settle in, sink and fade out (transform is free for
        // animation because dialogs are centred with margins, not translate).
        "dialog-in": {
          from: { opacity: "0", transform: "translateY(12px) scale(0.97)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "dialog-out": {
          from: { opacity: "1", transform: "translateY(0) scale(1)" },
          to: { opacity: "0", transform: "translateY(8px) scale(0.98)" },
        },
        "overlay-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "overlay-out": { from: { opacity: "1" }, to: { opacity: "0" } },
        "drawer-in": { from: { transform: "translateX(-100%)" }, to: { transform: "translateX(0)" } },
        "drawer-out": { from: { transform: "translateX(0)" }, to: { transform: "translateX(-100%)" } },
        "aurora-drift": {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(3%, -2%, 0) scale(1.06)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out",
        "slide-up": "slide-up 0.35s ease-out",
        "slide-in-right": "slide-in-right 0.2s ease-out",
        "status-ping": "status-ping 1.6s cubic-bezier(0, 0, 0.2, 1) infinite",
        "status-glow": "status-glow 2.2s ease-in-out infinite",
        sweep: "sweep 1.8s ease-in-out infinite",
        float: "float 6s ease-in-out infinite",
        "aurora-drift": "aurora-drift 24s ease-in-out infinite",
        // ease-out-expo in, ease-in out; exits are shorter so closing feels snappy.
        "dialog-in": "dialog-in 260ms cubic-bezier(0.16, 1, 0.3, 1)",
        "dialog-out": "dialog-out 160ms cubic-bezier(0.4, 0, 1, 1) forwards",
        "overlay-in": "overlay-in 220ms cubic-bezier(0.16, 1, 0.3, 1)",
        "overlay-out": "overlay-out 160ms cubic-bezier(0.4, 0, 1, 1) forwards",
        "drawer-in": "drawer-in 280ms cubic-bezier(0.16, 1, 0.3, 1)",
        "drawer-out": "drawer-out 180ms cubic-bezier(0.4, 0, 1, 1) forwards",
      },
    },
  },
  plugins: [],
};

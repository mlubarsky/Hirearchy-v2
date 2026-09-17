import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      screens: {
        // Tiny phones — between iPhone SE width and Tailwind's default sm (640px).
        // Useful for elements that should appear only after ~400px, like the wordmark.
        xs: "400px",
      },
      colors: {
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          elevated: "rgb(var(--surface-elevated) / <alpha-value>)",
          subtle: "rgb(var(--surface-subtle) / <alpha-value>)",
        },
        ink: {
          primary: "rgb(var(--ink-primary) / <alpha-value>)",
          secondary: "rgb(var(--ink-secondary) / <alpha-value>)",
          muted: "rgb(var(--ink-muted) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          hover: "rgb(var(--accent-hover) / <alpha-value>)",
          subtle: "rgb(var(--accent-subtle) / <alpha-value>)",
          fg: "rgb(var(--accent-fg) / <alpha-value>)",
        },
        border: {
          DEFAULT: "rgb(var(--border) / <alpha-value>)",
          subtle: "rgb(var(--border-subtle) / <alpha-value>)",
        },
        status: {
          applied: "rgb(var(--status-applied) / <alpha-value>)",
          interview: "rgb(var(--status-interview) / <alpha-value>)",
          offer: "rgb(var(--status-offer) / <alpha-value>)",
          rejected: "rgb(var(--status-rejected) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(0 0 0 / 0.05), 0 1px 3px 0 rgb(0 0 0 / 0.1)",
        elevated: "0 10px 30px -10px rgb(0 0 0 / 0.4)",
      },
      animation: {
        "fade-in": "fadeIn 200ms ease-out",
        "slide-up": "slideUp 240ms cubic-bezier(0.16, 1, 0.3, 1)",
        "milestone-enter": "milestoneEnter 550ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "milestone-exit": "milestoneExit 380ms cubic-bezier(0.4, 0, 1, 1) forwards",
        "milestone-icon": "milestoneIcon 700ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "milestone-sparkle": "milestoneSparkle 1.6s ease-in-out infinite",
        confetti: "confetti 1s cubic-bezier(0.12, 0.8, 0.4, 1) forwards",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        milestoneEnter: {
          "0%": { transform: "translate(-50%, -120%)", opacity: "0" },
          "55%": { transform: "translate(-50%, 10px)", opacity: "1" },
          "75%": { transform: "translate(-50%, -4px)" },
          "100%": { transform: "translate(-50%, 0)", opacity: "1" },
        },
        milestoneExit: {
          "0%": { transform: "translate(-50%, 0)", opacity: "1" },
          "100%": { transform: "translate(-50%, -130%)", opacity: "0" },
        },
        milestoneIcon: {
          "0%": { transform: "scale(0.4) rotate(-12deg)" },
          "60%": { transform: "scale(1.18) rotate(10deg)" },
          "100%": { transform: "scale(1) rotate(0deg)" },
        },
        milestoneSparkle: {
          "0%, 100%": { opacity: "0", transform: "scale(0.5)" },
          "50%": { opacity: "1", transform: "scale(1.15)" },
        },
        confetti: {
          "0%": { transform: "translate(0, 0) rotate(0deg)", opacity: "1" },
          "10%": { opacity: "1" },
          "100%": {
            transform: "translate(var(--dx), var(--dy)) rotate(var(--rot))",
            opacity: "0",
          },
        },
      },
    },
  },
} satisfies Config;

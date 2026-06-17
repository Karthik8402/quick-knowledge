/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        /* ── Core semantic tokens (CSS-variable driven, support opacity modifiers) ── */
        background:                     'rgb(var(--color-background) / <alpha-value>)',
        surface:                        'rgb(var(--color-surface) / <alpha-value>)',
        "surface-dim":                  'rgb(var(--color-surface-dim) / <alpha-value>)',
        "surface-bright":               'rgb(var(--color-surface-bright) / <alpha-value>)',
        "surface-container-lowest":     'rgb(var(--color-surface-container-lowest) / <alpha-value>)',
        "surface-container-low":        'rgb(var(--color-surface-container-low) / <alpha-value>)',
        "surface-container":            'rgb(var(--color-surface-container) / <alpha-value>)',
        "surface-container-high":       'rgb(var(--color-surface-container-high) / <alpha-value>)',
        "surface-container-highest":    'rgb(var(--color-surface-container-highest) / <alpha-value>)',
        "surface-variant":              'rgb(var(--color-surface-variant) / <alpha-value>)',
        "surface-tint":                 'rgb(var(--color-surface-tint) / <alpha-value>)',
        "on-surface":                   'rgb(var(--color-on-surface) / <alpha-value>)',
        "on-surface-variant":           'rgb(var(--color-on-surface-variant) / <alpha-value>)',
        "on-background":                'rgb(var(--color-on-background) / <alpha-value>)',
        "inverse-surface":              'rgb(var(--color-inverse-surface) / <alpha-value>)',
        "inverse-on-surface":           'rgb(var(--color-inverse-on-surface) / <alpha-value>)',
        "inverse-primary":              'rgb(var(--color-inverse-primary) / <alpha-value>)',
        outline:                        'rgb(var(--color-outline) / <alpha-value>)',
        "outline-variant":              'rgb(var(--color-outline-variant) / <alpha-value>)',

        /* ── Primary ── */
        primary:                        'rgb(var(--color-primary) / <alpha-value>)',
        "on-primary":                   'rgb(var(--color-on-primary) / <alpha-value>)',
        "primary-container":            'rgb(var(--color-primary-container) / <alpha-value>)',
        "on-primary-container":         'rgb(var(--color-on-primary-container) / <alpha-value>)',
        "primary-fixed":                'rgb(var(--color-primary-fixed) / <alpha-value>)',
        "primary-fixed-dim":            'rgb(var(--color-primary-fixed-dim) / <alpha-value>)',
        "on-primary-fixed":             'rgb(var(--color-on-primary-fixed) / <alpha-value>)',
        "on-primary-fixed-variant":     'rgb(var(--color-on-primary-fixed-variant) / <alpha-value>)',

        /* ── Secondary ── */
        secondary:                      'rgb(var(--color-secondary) / <alpha-value>)',
        "on-secondary":                 'rgb(var(--color-on-secondary) / <alpha-value>)',
        "secondary-container":          'rgb(var(--color-secondary-container) / <alpha-value>)',
        "on-secondary-container":       'rgb(var(--color-on-secondary-container) / <alpha-value>)',
        "secondary-fixed":              'rgb(var(--color-secondary-fixed) / <alpha-value>)',
        "secondary-fixed-dim":          'rgb(var(--color-secondary-fixed-dim) / <alpha-value>)',
        "on-secondary-fixed":           'rgb(var(--color-on-secondary-fixed) / <alpha-value>)',
        "on-secondary-fixed-variant":   'rgb(var(--color-on-secondary-fixed-variant) / <alpha-value>)',

        /* ── Tertiary ── */
        tertiary:                       'rgb(var(--color-tertiary) / <alpha-value>)',
        "on-tertiary":                  'rgb(var(--color-on-tertiary) / <alpha-value>)',
        "tertiary-container":           'rgb(var(--color-tertiary-container) / <alpha-value>)',
        "on-tertiary-container":        'rgb(var(--color-on-tertiary-container) / <alpha-value>)',
        "tertiary-fixed":               'rgb(var(--color-tertiary-fixed) / <alpha-value>)',
        "tertiary-fixed-dim":           'rgb(var(--color-tertiary-fixed-dim) / <alpha-value>)',
        "on-tertiary-fixed":            'rgb(var(--color-on-tertiary-fixed) / <alpha-value>)',
        "on-tertiary-fixed-variant":    'rgb(var(--color-on-tertiary-fixed-variant) / <alpha-value>)',

        /* ── Error ── */
        error:                          'rgb(var(--color-error) / <alpha-value>)',
        "on-error":                     'rgb(var(--color-on-error) / <alpha-value>)',
        "error-container":              'rgb(var(--color-error-container) / <alpha-value>)',
        "on-error-container":           'rgb(var(--color-on-error-container) / <alpha-value>)',
      },
      fontFamily: {
        headline: ["Space Grotesk", "sans-serif"],
        body: ["Inter", "sans-serif"],
        label: ["Inter", "sans-serif"],
      },
      animation: {
        "fade-in-up": "fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in-down": "fadeInDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) both",
        "slide-in-left": "slideInLeft 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        "slide-in-right": "slideInRight 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        "scale-in": "scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both",
        "shimmer": "shimmer 1.8s ease-in-out infinite",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        "float": "float 4s ease-in-out infinite",
        "gradient-shift": "gradientShift 6s ease infinite",
        "toast-in": "slideToast 0.4s cubic-bezier(0.16, 1, 0.3, 1) both",
        "toast-out": "slideToastOut 0.3s ease-in both",
        // Spatial UI 3D animations
        "morph-blob": "morphBlob 18s ease-in-out infinite",
        "orbit": "orbit 20s linear infinite",
        "particle-drift": "particleDrift 20s ease-in-out infinite",
        "glow-pulse": "glowPulse 2.5s ease-in-out infinite",
        "perspective-float": "perspectiveFloat 6s ease-in-out infinite",
        "border-glow-spatial": "borderGlowSpatial 3s ease-in-out infinite",
        "pulse-ring": "pulseRing 1.5s ease-out forwards",
      },
      keyframes: {
        fadeInUp: {
          from: { opacity: "0", transform: "translateY(24px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        fadeInDown: {
          from: { opacity: "0", transform: "translateY(-16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideInLeft: {
          from: { opacity: "0", transform: "translateX(-32px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        slideInRight: {
          from: { opacity: "0", transform: "translateX(32px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        scaleIn: {
          from: { opacity: "0", transform: "scale(0.92)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 6px rgba(var(--color-primary), 0.3)" },
          "50%": { boxShadow: "0 0 20px rgba(var(--color-primary), 0.7), 0 0 40px rgba(var(--color-primary), 0.2)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        gradientShift: {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        slideToast: {
          from: { opacity: "0", transform: "translateX(100%) scale(0.95)" },
          to: { opacity: "1", transform: "translateX(0) scale(1)" },
        },
        slideToastOut: {
          from: { opacity: "1", transform: "translateX(0) scale(1)" },
          to: { opacity: "0", transform: "translateX(100%) scale(0.95)" },
        },
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};

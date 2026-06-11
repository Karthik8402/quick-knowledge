import { useTheme, type ThemePreference } from '../hooks/useTheme';

interface ThemeToggleButtonProps {
  className?: string;
}

const THEME_CYCLE: ThemePreference[] = ['system', 'light', 'dark'];
const THEME_ICON: Record<ThemePreference, string> = {
  system: 'brightness_auto',
  light: 'light_mode',
  dark: 'dark_mode',
};
const THEME_LABEL: Record<ThemePreference, string> = {
  system: 'Switch to light theme',
  light: 'Switch to dark theme',
  dark: 'Switch to system theme',
};

export function ThemeToggleButton({ className = '' }: ThemeToggleButtonProps) {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    const idx = THEME_CYCLE.indexOf(theme);
    setTheme(THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]);
  };

  const ariaLabel = THEME_LABEL[theme] || 'Toggle theme';

  return (
    <button
      onClick={cycleTheme}
      type="button"
      className={`w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors ${className}`}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <span className="material-symbols-outlined text-lg text-outline hover:text-on-surface transition-colors">
        {THEME_ICON[theme]}
      </span>
    </button>
  );
}

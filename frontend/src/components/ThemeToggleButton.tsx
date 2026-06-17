import { useTheme, type ThemePreference } from '../hooks/useTheme';
import { Sun, Moon, Laptop } from 'lucide-react';

interface ThemeToggleButtonProps {
  className?: string;
}

const THEME_CYCLE: ThemePreference[] = ['system', 'light', 'dark'];

export function ThemeToggleButton({ className = '' }: ThemeToggleButtonProps) {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    const idx = THEME_CYCLE.indexOf(theme);
    setTheme(THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]);
  };

  const ariaLabel = {
    system: 'Switch to light theme',
    light: 'Switch to dark theme',
    dark: 'Switch to system theme',
  }[theme] || 'Toggle theme';

  return (
    <button
      onClick={cycleTheme}
      type="button"
      className={`w-9 h-9 flex items-center justify-center rounded-lg border border-outline-variant/20 bg-surface/40 hover:bg-surface-container hover:text-on-surface text-outline transition-all duration-200 backdrop-blur-md cursor-pointer ${className}`}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      {theme === 'system' && <Laptop className="w-4 h-4" />}
      {theme === 'light' && <Sun className="w-4 h-4" />}
      {theme === 'dark' && <Moon className="w-4 h-4" />}
    </button>
  );
}


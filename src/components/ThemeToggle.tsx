import type { ThemeName } from "../lib/types";

interface ThemeToggleProps {
  theme: ThemeName;
  onToggle: () => void;
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={onToggle}
      aria-label={theme === "dark" ? "ライトテーマに切り替え" : "ダークテーマに切り替え"}
      title={theme === "dark" ? "Light" : "Dark"}
    >
      {theme === "dark" ? "☾" : "☀"}
    </button>
  );
}

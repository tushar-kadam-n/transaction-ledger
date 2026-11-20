import { THEMES, useTheme, type Theme } from "../../theme";

const THEME_LABELS: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
  midnight: "Midnight",
  forest: "Forest",
};

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <label className="theme-selector">
      <span>Theme</span>
      <select
        aria-label="Select theme"
        value={theme}
        onChange={(event) => setTheme(event.target.value as Theme)}
      >
        {THEMES.map((option) => (
          <option key={option} value={option}>
            {THEME_LABELS[option]}
          </option>
        ))}
      </select>
    </label>
  );
}

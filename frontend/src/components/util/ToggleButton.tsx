import { MoonStar, SunMedium } from "lucide-react";
import { useTheme } from "../useTheme";
import { type AppSettings } from "../useSettings";

export default function ThemeToggle() {
  const { theme, switchTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={switchTheme}
      aria-label={
        isDark
          ? "Switch to light mode"
          : "Switch to dark mode"
      }
      aria-pressed={isDark}
      title={
        isDark ? "Light mode" : "Dark mode"
      }
      className="group relative inline-flex h-7 w-12 items-center rounded-full bg-neutral-200 p-0.5 transition-colors hover:bg-neutral-300 dark:bg-neutral-400 dark:hover:bg-neutral-500"
    >
      <div
        className={`flex h-5 w-5 items-center justify-center rounded-full bg-neutral-50 text-neutral-700 shadow-sm transition-transform duration-200 ${
          isDark ? "translate-x-5.5" : "translate-x-0.5"
        }`}
      />
      <span className="sr-only">
        {isDark ? "Dark mode on" : "Light mode on"}
      </span>
      <SunMedium
        size={14}
        className={`pointer-events-none absolute ml-1 transition-opacity duration-200 ${
          isDark
            ? "opacity-0"
            : "opacity-70 text-neutral-600"
        }`}
      />
      <MoonStar
        size={14}
        className={`pointer-events-none absolute right-1.5 transition-opacity duration-200 ${
          isDark
            ? "opacity-80 text-sky-200"
            : "opacity-0"
        }`}
      />
    </button>
  );
}

export function SettingToggle({
  settingKey,
  value,
  toggleSetting,
}: {
  settingKey: keyof AppSettings;
  value: boolean;

  toggleSetting: <K extends keyof AppSettings>(
    key: K
  ) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => toggleSetting(settingKey)}
      aria-pressed={value}
      title={settingKey}
      className={`
        relative inline-flex h-5 w-9 items-center rounded-full
        p-0.5 transition-colors
        ${
          value
            ? "bg-neutral-700"
            : "bg-neutral-300"
        }
      `}
    >
      <div
        className={`
          h-4 w-4 rounded-full bg-white shadow-sm
          transition-transform duration-200
          ${
            value
              ? "translate-x-4"
              : "translate-x-0"
          }
        `}
      />
    </button>
  );
}
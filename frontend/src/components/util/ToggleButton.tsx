import { MoonStar, SunMedium } from "lucide-react";
import { useTheme } from "../useTheme";
import { type AppSettings } from "../useSettings";

export default function ThemeToggle({
  compact = false,
}: {
  compact?: boolean;
}) {
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
      className={
        compact
          ? "group inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
          : "group relative inline-flex h-7 w-12 items-center rounded-full p-0.5 bg-neutral-300 transition-colors hover:bg-neutral-400"
      }
    >
      {compact ? (
        isDark ? (
          <SunMedium
            size={16}
            className="transition-transform duration-200 group-hover:rotate-12"
          />
        ) : (
          <MoonStar
            size={16}
            className="transition-transform duration-200 group-hover:-rotate-12"
          />
        )
      ) : (
        <>
          <div
            className={`flex h-5 w-5 items-center justify-center rounded-full bg-neutral-50 transition-transform duration-200 ${
              isDark ? "translate-x-5.5" : "translate-x-0.5"
            }`}
          />
          <SunMedium
            size={14}
            className={`pointer-events-none absolute left-1.75 text-neutral-400 transition-opacity duration-200 ${
              isDark
                ? "opacity-0"
                : "opacity-100"
            }`}
          />
          <MoonStar
            size={14}
            className={`pointer-events-none absolute right-1.75 text-neutral-400 transition-opacity duration-200 ${
              isDark
                ? "opacity-100"
                : "opacity-0"
            }`}
          />
        </>
      )}
      <span className="sr-only">
        {isDark ? "Dark mode on" : "Light mode on"}
      </span>
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
        p-0.5 transition-colors bg-neutral-300 hover:bg-neutral-400
      `}
    >
      <div
        className={`
          h-4 w-4 rounded-full bg-neutral-50
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

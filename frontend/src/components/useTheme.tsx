import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  switchTheme: () => void;
};

const STORAGE_KEY = "theme";
const MEDIA_QUERY = "(prefers-color-scheme: dark)";

const ThemeContext =
  createContext<ThemeContextValue | null>(null);

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark";
}

function getSystemTheme(): Theme {
  return window.matchMedia(MEDIA_QUERY).matches
    ? "dark"
    : "light";
}

function getStoredTheme(): Theme | null {
  const storedTheme =
    window.localStorage.getItem(STORAGE_KEY);

  return isTheme(storedTheme) ? storedTheme : null;
}

export function resolveInitialTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  return getStoredTheme() ?? getSystemTheme();
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;

  root.classList.toggle("dark", theme === "dark");
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

export function ThemeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [theme, setThemeState] = useState<Theme>(() =>
    resolveInitialTheme()
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const media = window.matchMedia(MEDIA_QUERY);

    const syncSystemTheme = () => {
      if (getStoredTheme() !== null) {
        return;
      }

      setThemeState(getSystemTheme());
    };

    syncSystemTheme();
    media.addEventListener("change", syncSystemTheme);

    return () => {
      media.removeEventListener(
        "change",
        syncSystemTheme
      );
    };
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme: (nextTheme: Theme) => {
        window.localStorage.setItem(
          STORAGE_KEY,
          nextTheme
        );
        setThemeState(nextTheme);
      },
      switchTheme: () => {
        setThemeState((currentTheme) => {
          const nextTheme =
            currentTheme === "dark"
              ? "light"
              : "dark";

          window.localStorage.setItem(
            STORAGE_KEY,
            nextTheme
          );

          return nextTheme;
        });
      },
    }),
    [theme]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error(
      "useTheme must be used inside ThemeProvider"
    );
  }

  return context;
}

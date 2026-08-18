'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  ThemeContext,
  type Theme,
} from '@/hooks/useTheme';

interface ThemeProviderProps {
  children: React.ReactNode;
}

/**
 * Reads the persisted theme from localStorage.
 * Falls back to DEFAULT_THEME ('dark') if nothing is stored or value is invalid.
 */
function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  return DEFAULT_THEME;
}

/**
 * Applies or removes the 'dark' class on the <html> element
 * to drive Tailwind's dark mode.
 */
function applyThemeClass(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

/**
 * ThemeProvider — wraps the app to provide theme context.
 * - Dark-mode-first: defaults to 'dark'
 * - Persists choice in localStorage under key 'dashboard-theme'
 * - Manages the 'dark' class on <html> for Tailwind
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  // On mount, read persisted theme and apply class
  useEffect(() => {
    const stored = getStoredTheme();
    setThemeState(stored);
    applyThemeClass(stored);
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    applyThemeClass(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      applyThemeClass(next);
      localStorage.setItem(THEME_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const value = {
    theme,
    toggleTheme,
    setTheme,
    isDark: theme === 'dark',
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

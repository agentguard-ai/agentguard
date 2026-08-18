'use client';

import { useContext, createContext } from 'react';

export type Theme = 'dark' | 'light';

export interface ThemeContextValue {
  /** Current active theme */
  theme: Theme;
  /** Toggle between dark and light mode */
  toggleTheme: () => void;
  /** Set a specific theme */
  setTheme: (theme: Theme) => void;
  /** Convenience boolean: true when current theme is 'dark' */
  isDark: boolean;
}

export const THEME_STORAGE_KEY = 'dashboard-theme';
export const DEFAULT_THEME: Theme = 'dark';

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Hook providing theme state and controls.
 * Must be used within a ThemeProvider.
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

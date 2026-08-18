import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { useTheme, THEME_STORAGE_KEY, DEFAULT_THEME, ThemeContext } from './useTheme';
import { ThemeProvider } from '@/providers/ThemeProvider';

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('dark'); // reset to dark-first
  });

  it('throws when used outside ThemeProvider', () => {
    expect(() => {
      renderHook(() => useTheme());
    }).toThrow('useTheme must be used within a ThemeProvider');
  });

  it('defaults to dark theme', () => {
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });
    expect(result.current.theme).toBe('dark');
    expect(result.current.isDark).toBe(true);
  });

  it('reads persisted theme from localStorage on mount', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });
    expect(result.current.theme).toBe('light');
    expect(result.current.isDark).toBe(false);
  });

  it('toggleTheme switches from dark to light', () => {
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });
    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe('light');
    expect(result.current.isDark).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('toggleTheme switches from light to dark', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });
    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe('dark');
    expect(result.current.isDark).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('setTheme explicitly sets light mode', () => {
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });
    act(() => {
      result.current.setTheme('light');
    });
    expect(result.current.theme).toBe('light');
    expect(result.current.isDark).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('applies dark class on <html> when theme is dark', () => {
    document.documentElement.classList.remove('dark');
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });
    // Default is dark, so class should be re-added on mount
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('removes dark class on <html> when theme is light', () => {
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });
    act(() => {
      result.current.setTheme('light');
    });
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('persists theme to localStorage with correct key', () => {
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });
    act(() => {
      result.current.setTheme('light');
    });
    expect(localStorage.getItem('dashboard-theme')).toBe('light');
    act(() => {
      result.current.setTheme('dark');
    });
    expect(localStorage.getItem('dashboard-theme')).toBe('dark');
  });

  it('falls back to dark theme when localStorage has invalid value', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'invalid-value');
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });
    expect(result.current.theme).toBe('dark');
  });
});

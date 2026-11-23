// Light / dark theme. Decision (19 Nov 2026): start LIGHT, remember the user's choice, never follow the OS setting.
// The theme is `<html data-theme="light|dark">`; every colour is a CSS variable in src/index.css, so screens flip by
// themselves. index.html applies the stored choice before first paint (same storage key) to avoid a light flash.
import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';
export const THEME_STORAGE_KEY = 'jms-theme';

const listeners = new Set<() => void>();

function stored(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light'; // storage blocked (private mode etc.): default light, choice not remembered
  }
}

function apply(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

let current: Theme = typeof document === 'undefined' ? 'light' : stored();
if (typeof document !== 'undefined') apply(current);

export function getTheme(): Theme {
  return current;
}

export function setTheme(theme: Theme) {
  if (theme === current) return;
  current = theme;
  apply(theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // storage blocked: the theme still applies for this session
  }
  listeners.forEach((l) => l());
}

export function toggleTheme() {
  setTheme(current === 'dark' ? 'light' : 'dark');
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** Current theme; re-renders on change. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme, () => 'light' as Theme);
}

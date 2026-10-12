import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/** Accent palettes. `color` = primary button colour, `night` = night-mode page background (both feed the browser theme-color). */
export const PALETTES = [
  // Refined: muted, premium tones
  { id: 'navy', label: 'Navy', group: 'Refined', color: '#1F3A5F', night: '#11161E' },
  { id: 'sage', label: 'Sage', group: 'Refined', color: '#4A6B57', night: '#121613' },
  { id: 'bronze', label: 'Bronze', group: 'Refined', color: '#8A5A3C', night: '#181411' },
  { id: 'petrol', label: 'Petrol', group: 'Refined', color: '#0F5C63', night: '#101719' },
  { id: 'burgundy', label: 'Burgundy', group: 'Refined', color: '#7A2E45', night: '#181114' },
  { id: 'silver', label: 'Silver', group: 'Refined', color: '#475569', night: '#16181C' },
  { id: 'gold', label: 'Gold', group: 'Refined', color: '#A16207', night: '#18150E' },
  // Vibrant: brighter accents
  { id: 'indigo', label: 'Indigo', group: 'Vibrant', color: '#4F46E5', night: '#151822' },
  { id: 'ocean', label: 'Ocean', group: 'Vibrant', color: '#0369A1', night: '#121A1F' },
  { id: 'emerald', label: 'Emerald', group: 'Vibrant', color: '#047857', night: '#131A17' },
  { id: 'violet', label: 'Violet', group: 'Vibrant', color: '#6D28D9', night: '#16141D' },
];

const ThemeContext = createContext({ theme: 'light', toggle: () => {}, palette: 'indigo', setPalette: () => {} });
export const useTheme = () => useContext(ThemeContext);

const readTheme = () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
const readPalette = () => {
  const p = document.documentElement.dataset.palette;
  return PALETTES.some((x) => x.id === p) ? p : 'indigo';
};

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readTheme);
  const [palette, setPalette] = useState(readPalette);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try { localStorage.setItem('es-theme', theme); } catch { /* storage unavailable */ }
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.palette = palette;
    const current = PALETTES.find((p) => p.id === palette);
    const color = theme === 'dark' ? current?.night : current?.color;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color || '#4F46E5');
    try { localStorage.setItem('es-palette', palette); } catch { /* storage unavailable */ }
  }, [palette, theme]);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  const value = useMemo(() => ({ theme, toggle, setTheme, palette, setPalette }), [theme, toggle, palette]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

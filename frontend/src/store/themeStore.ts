import { create } from 'zustand';

interface ThemeState {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}

function getStoredTheme(): 'dark' | 'light' {
  try {
    return (localStorage.getItem('nd-theme') as 'dark' | 'light') || 'dark';
  } catch {
    return 'dark';
  }
}

function applyTheme(theme: 'dark' | 'light') {
  if (theme === 'light') {
    document.documentElement.classList.add('light');
  } else {
    document.documentElement.classList.remove('light');
  }
  localStorage.setItem('nd-theme', theme);
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: getStoredTheme(),
  toggleTheme: () =>
    set((s) => {
      const next = s.theme === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      return { theme: next };
    }),
}));

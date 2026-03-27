import React, { createContext, useContext } from 'react';
import { trattoria, ThemeColors } from '../constants/themes';

interface ThemeContextValue {
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: trattoria,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeContext.Provider value={{ colors: trattoria }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

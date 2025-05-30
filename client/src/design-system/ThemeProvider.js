import React, { createContext, useContext, useState, useEffect } from 'react';
import tokens from './tokens';

/**
 * Healthcare AI Platform Theme Provider
 * 
 * Strategic Business Impact:
 * - Provides centralized theme management across all clinical interfaces
 * - Supports HIPAA-compliant dark mode for reducing eye strain in clinical settings
 * - Enables adaptive color schemes for different clinical departments
 * - Maintains consistent branding while allowing contextual adaptations
 */

// Create theme context
const ThemeContext = createContext({
  theme: 'light',
  colorScheme: 'default',
  setTheme: () => {},
  setColorScheme: () => {},
  tokens: {},
});

// Theme provider component
export const ThemeProvider = ({ children, initialTheme = 'light', initialColorScheme = 'default' }) => {
  // State for theme and color scheme
  const [theme, setTheme] = useState(initialTheme);
  const [colorScheme, setColorScheme] = useState(initialColorScheme);
  
  // Effect to apply theme to document
  useEffect(() => {
    // Apply theme class to document
    document.documentElement.classList.remove('light-theme', 'dark-theme');
    document.documentElement.classList.add(`${theme}-theme`);
    
    // Store user preference
    localStorage.setItem('healthcare-theme', theme);
    localStorage.setItem('healthcare-color-scheme', colorScheme);
    
    // Set meta theme color for mobile devices
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute(
        'content', 
        theme === 'light' ? tokens.colors.neutral[50] : tokens.colors.neutral[900]
      );
    }
  }, [theme, colorScheme]);

  // Initialize theme from user preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('healthcare-theme');
    const savedColorScheme = localStorage.getItem('healthcare-color-scheme');
    
    // Check for saved preferences
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      // If no saved preference, use system preference
      setTheme('dark');
    }
    
    if (savedColorScheme) {
      setColorScheme(savedColorScheme);
    }
    
    // Listen for system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      if (!localStorage.getItem('healthcare-theme')) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Calculate the actual tokens based on current theme
  const getThemedTokens = () => {
    // Clone base tokens
    const themedTokens = { ...tokens };
    
    // Apply theme-specific overrides
    if (theme === 'dark') {
      // Invert background/foreground colors for dark mode
      themedTokens.colors.utility.background = tokens.colors.neutral[900];
      themedTokens.colors.utility.surface = tokens.colors.neutral[800];
      
      // Adjust text colors for dark mode
      themedTokens.textColor = {
        primary: tokens.colors.neutral[50],
        secondary: tokens.colors.neutral[300],
        tertiary: tokens.colors.neutral[400],
      };
      
      // Adjust borders for dark mode
      themedTokens.borderColor = tokens.colors.neutral[700];
    } else {
      // Default light theme colors
      themedTokens.textColor = {
        primary: tokens.colors.neutral[900],
        secondary: tokens.colors.neutral[700],
        tertiary: tokens.colors.neutral[500],
      };
      
      // Default light borders
      themedTokens.borderColor = tokens.colors.neutral[200];
    }
    
    // Apply color scheme overrides (for department-specific themes)
    switch (colorScheme) {
      case 'cardiology':
        themedTokens.colors.primary = {
          ...tokens.colors.primary,
          500: '#ef4444', // Cardiology red
        };
        break;
      case 'neurology':
        themedTokens.colors.primary = {
          ...tokens.colors.primary,
          500: '#8b5cf6', // Neurology purple
        };
        break;
      case 'pediatrics':
        themedTokens.colors.primary = {
          ...tokens.colors.primary,
          500: '#22c55e', // Pediatrics green
        };
        break;
      default:
        // Use default blue
        break;
    }
    
    return themedTokens;
  };

  // Provide theme context to children
  return (
    <ThemeContext.Provider
      value={{
        theme,
        colorScheme,
        setTheme,
        setColorScheme,
        tokens: getThemedTokens(),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

// Hook for using theme in components
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeProvider;

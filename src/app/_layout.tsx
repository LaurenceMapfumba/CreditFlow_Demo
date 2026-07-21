import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import LoginForm from '@/components/login-form';
import { AuthProvider, useAuth } from '@/contexts/auth-context';

function RootContent() {
  const { isAuthenticated } = useAuth();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;

  if (!isAuthenticated) {
    return (
      <ThemeProvider value={theme}>
        <LoginForm />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider value={theme}>
      <AnimatedSplashOverlay />
      <AppTabs />
    </ThemeProvider>
  );
}

export default function TabLayout() {
  return (
    <AuthProvider>
      <RootContent />
    </AuthProvider>
  );
}

import 'react-native-gesture-handler';
import React, { useCallback, useEffect } from 'react';
import { I18nManager, View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts as useCairoFonts,
  Cairo_400Regular,
  Cairo_600SemiBold,
  Cairo_700Bold,
  Cairo_800ExtraBold,
} from '@expo-google-fonts/cairo';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
} from '@expo-google-fonts/space-grotesk';

import RootNavigator from './src/navigation/RootNavigator';
import { colors } from './src/theme/theme';
import { AuthProvider } from './src/context/AuthContext';
import { DataProvider } from './src/context/DataContext';
import { CartProvider } from './src/context/CartContext';
import { FavoritesProvider } from './src/context/FavoritesContext';
import ErrorBoundary from './src/components/ErrorBoundary';

if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [fontsLoaded, fontError] = useCairoFonts({
    Cairo_400Regular,
    Cairo_600SemiBold,
    Cairo_700Bold,
    Cairo_800ExtraBold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
  });

  const fontsReady = fontsLoaded || !!fontError;

  const hideSplashScreen = useCallback(async () => {
    if (fontsReady) {
      await SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsReady]);

  useEffect(() => {
    if (fontsReady) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsReady]);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <DataProvider>
            <CartProvider>
              <FavoritesProvider>
                <View style={[styles.container, { backgroundColor: colors.background }]} onLayout={hideSplashScreen}>
                  <StatusBar style="dark" />
                  <NavigationContainer>
                    <RootNavigator />
                  </NavigationContainer>
                </View>
              </FavoritesProvider>
            </CartProvider>
          </DataProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
import 'react-native-gesture-handler';
import React, { useCallback, useEffect } from 'react';
import { I18nManager, View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { NavigationContainer, getPathFromState, getStateFromPath } from '@react-navigation/native';
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

const linking = {
  // The query-string form keeps product links directly openable on GitHub Pages
  // without requiring a server-side SPA fallback for nested paths.
  prefixes: [
    'https://easifycraw-byte.github.io/KILIXWEBAPP',
    'https://easifycraw-byte.github.io/KILIXWEBAPP/',
    'kilix://',
  ],
  getStateFromPath(path, options) {
    const value = String(path || '');
    const match =
      value.match(/[?&]product=([^&/#]+)/i) ||
      value.match(/(?:^|\/)product\/([^?/#]+)/i);

    if (match?.[1]) {
      let productId = match[1];
      try {
        productId = decodeURIComponent(productId);
      } catch (_) {
        // Keep the raw value if decoding fails.
      }
      return {
        routes: [
          {
            name: 'ProductDetail',
            params: { productId },
          },
        ],
      };
    }

    return getStateFromPath(path, options);
  },
  getPathFromState(state, options) {
    const productRoute = state?.routes?.find((route) => route?.name === 'ProductDetail');
    const productId =
      productRoute?.params?.productId ||
      productRoute?.params?.product?.id ||
      null;

    if (productRoute && productId) {
      return `?product=${encodeURIComponent(String(productId))}`;
    }

    return getPathFromState(state, options);
  },
};

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
                  <NavigationContainer linking={linking}>
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
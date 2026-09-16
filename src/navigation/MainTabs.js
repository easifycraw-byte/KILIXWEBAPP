import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, sizes } from '../theme/theme';

import HomeScreen from '../screens/HomeScreen';
import OrdersScreen from '../screens/OrdersScreen';
import MessagesScreen from '../screens/MessagesScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

const ICONS = {
  الرئيسية: 'home',
  طلباتي: 'inventory-2',
  الرسائل: 'chat-bubble',
  حسابي: 'person',
};

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.orangeVibrant,
        tabBarInactiveTintColor: colors.outline,
        tabBarStyle: {
          height: sizes.navBarHeight,
          paddingBottom: 8,
          paddingTop: 6,
          backgroundColor: colors.surface,
          borderTopColor: colors.outlineVariant,
          borderTopWidth: sizes.borderHairline,
        },
        tabBarItemStyle: { minHeight: sizes.touchTarget },
        tabBarIcon: ({ color, size }) => (
          <MaterialIcons name={ICONS[route.name]} size={sizes.iconLg} color={color} />
        ),
        tabBarLabelStyle: { fontFamily: 'Cairo_600SemiBold', fontSize: 11, letterSpacing: 0.1 },
      })}
    >
      <Tab.Screen name="الرئيسية" component={HomeScreen} />
      <Tab.Screen name="طلباتي" component={OrdersScreen} />
      <Tab.Screen name="الرسائل" component={MessagesScreen} />
      <Tab.Screen name="حسابي" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

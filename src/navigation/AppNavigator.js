import React from 'react';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';

const linking = Platform.OS !== 'web' ? {
  prefixes: ['splitwise://'],
  config: {
    screens: {
      Auth: 'login',
      Main: {
        screens: {
          Home: 'home',
          Groups: 'groups',
          Friends: 'friends',
          Activity: 'activity',
        },
      },
      GroupDetail: 'group/:groupId',
      Profile: 'profile',
    },
  },
} : undefined;
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useApp } from '../context/AppContext';
import { COLORS } from '../constants/colors';
import SyncBanner from '../components/SyncBanner';

import AuthScreen from '../screens/AuthScreen';
import HomeScreen from '../screens/HomeScreen';
import GroupsScreen from '../screens/GroupsScreen';
import GroupDetailScreen from '../screens/GroupDetailScreen';
import AddExpenseScreen from '../screens/AddExpenseScreen';
import FriendsScreen from '../screens/FriendsScreen';
import ActivityScreen from '../screens/ActivityScreen';
import SettleUpScreen from '../screens/SettleUpScreen';
import ProfileScreen from '../screens/ProfileScreen';
import CurrencyScreen from '../screens/CurrencyScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const MainTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarShowLabel: true,
      tabBarActiveTintColor: COLORS.primary,
      tabBarInactiveTintColor: COLORS.textMuted,
      tabBarStyle: {
        backgroundColor: COLORS.white,
        borderTopColor: COLORS.border,
        height: 82,
        paddingBottom: 20,
        paddingTop: 8,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 12,
      },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: 2 },
      tabBarIcon: ({ focused, color, size }) => {
        const icons = {
          Home: focused ? 'home' : 'home-outline',
          Groups: focused ? 'people' : 'people-outline',
          Friends: focused ? 'person' : 'person-outline',
          Activity: focused ? 'time' : 'time-outline',
        };
        return <Ionicons name={icons[route.name]} size={22} color={color} />;
      },
    })}
  >
    <Tab.Screen name="Home" component={HomeScreen} />
    <Tab.Screen name="Groups" component={GroupsScreen} />
    <Tab.Screen name="Friends" component={FriendsScreen} />
    <Tab.Screen name="Activity" component={ActivityScreen} />
  </Tab.Navigator>
);

const AppNavigator = () => {
  const { user, loading, syncStatus } = useApp();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width > 768;

  if (loading) return null;

  return (
    <View style={isDesktop ? styles.desktopContainer : { flex: 1 }}>
      <View style={isDesktop ? styles.desktopApp : { flex: 1 }}>
        <NavigationContainer linking={linking}>
          <View style={{ flex: 1 }}>
            <Stack.Navigator screenOptions={{ headerShown: false, cardStyle: { backgroundColor: COLORS.background } }}>
              {!user ? (
                <Stack.Screen name="Auth" component={AuthScreen} />
              ) : (
                <>
                  <Stack.Screen name="Main" component={MainTabs} />
                  <Stack.Screen name="GroupDetail" component={GroupDetailScreen} options={{ presentation: 'card' }} />
                  <Stack.Screen name="AddExpense" component={AddExpenseScreen} options={{ presentation: 'modal' }} />
                  <Stack.Screen name="SettleUp" component={SettleUpScreen} options={{ presentation: 'modal' }} />
                  <Stack.Screen name="Profile" component={ProfileScreen} options={{ presentation: 'card' }} />
                  <Stack.Screen name="Currency" component={CurrencyScreen} options={{ presentation: 'card' }} />
                </>
              )}
            </Stack.Navigator>
            <SyncBanner status={syncStatus} />
          </View>
        </NavigationContainer>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  desktopContainer: {
    flex: 1,
    backgroundColor: '#E8EAF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  desktopApp: {
    width: 430,
    maxWidth: '100%',
    flex: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
});

export default AppNavigator;

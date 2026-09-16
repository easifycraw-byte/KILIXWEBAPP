import AsyncStorage from '@react-native-async-storage/async-storage';

// Web-safe storage adapter. This is only a local browser cache and does not
// create, modify, or delete anything in Supabase.
export const setItemAsync = (key, value) => AsyncStorage.setItem(key, value);
export const getItemAsync = (key) => AsyncStorage.getItem(key);
export const deleteItemAsync = (key) => AsyncStorage.removeItem(key);

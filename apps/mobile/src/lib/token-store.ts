import * as SecureStore from 'expo-secure-store';

// Where the refresh token lives: the keychain / keystore on the phone (token-store.web.ts for the browser).
export const getItem = (key: string) => SecureStore.getItemAsync(key);
export const setItem = (key: string, value: string) => SecureStore.setItemAsync(key, value);
export const deleteItem = (key: string) => SecureStore.deleteItemAsync(key);

// The browser has no secure store: the refresh token is kept in localStorage (the site has no third-party scripts).
function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export async function getItem(key: string) {
  return storage()?.getItem(key) ?? null;
}
export async function setItem(key: string, value: string) {
  storage()?.setItem(key, value);
}
export async function deleteItem(key: string) {
  storage()?.removeItem(key);
}

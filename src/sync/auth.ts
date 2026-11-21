import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';

/**
 * Google sign-in with the `drive.file` scope: the app sees only the files it created.
 * An iOS OAuth client ID is a public identifier, not a secret; PKCE protects the exchange.
 * The refresh token stays in the iOS Keychain and never enters the journal folder.
 */

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

const K_CLIENT = 'drive.clientId';
const K_REFRESH = 'drive.refreshToken';
const K_EMAIL = 'drive.account';

export function isValidClientId(id: string): boolean {
  return /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(id.trim());
}

/** Google's redirect for iOS clients: the reversed client ID as a URL scheme. */
export function redirectFor(clientId: string): string {
  const prefix = clientId.trim().replace(/\.apps\.googleusercontent\.com$/, '');
  return `com.googleusercontent.apps.${prefix}:/oauth2redirect`;
}

let access: { token: string; expires: number } | null = null;

export async function storedClientId(): Promise<string | null> {
  return SecureStore.getItemAsync(K_CLIENT);
}

export async function isConnected(): Promise<boolean> {
  return !!(await SecureStore.getItemAsync(K_REFRESH)) && !!(await storedClientId());
}

export async function connectedAccount(): Promise<string | null> {
  return SecureStore.getItemAsync(K_EMAIL);
}

export async function signIn(clientId: string): Promise<void> {
  const id = clientId.trim();
  const redirectUri = redirectFor(id);
  const request = new AuthSession.AuthRequest({
    clientId: id,
    redirectUri,
    scopes: [DRIVE_SCOPE, 'email'],
    usePKCE: true,
    extraParams: { access_type: 'offline', prompt: 'consent' },
  });
  const result = await request.promptAsync(discovery);
  if (result.type !== 'success') {
    throw new Error(
      result.type === 'error' ? (result.error?.message ?? 'Google sign-in failed.') : 'Sign-in was cancelled.',
    );
  }
  const tokens = await AuthSession.exchangeCodeAsync(
    { clientId: id, code: result.params.code, redirectUri, extraParams: { code_verifier: request.codeVerifier ?? '' } },
    discovery,
  );
  if (!tokens.refreshToken) throw new Error('Google did not grant offline access. Try connecting again.');
  await SecureStore.setItemAsync(K_CLIENT, id);
  await SecureStore.setItemAsync(K_REFRESH, tokens.refreshToken);
  access = { token: tokens.accessToken, expires: Date.now() + (tokens.expiresIn ?? 3600) * 1000 };
  try {
    const me = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    if (me.ok) {
      const j = (await me.json()) as { email?: string };
      if (j.email) await SecureStore.setItemAsync(K_EMAIL, j.email);
    }
  } catch {
    // The account name is only shown for reassurance.
  }
}

export class AuthLostError extends Error {}

/** A valid access token, refreshed when needed. */
export async function accessToken(): Promise<string> {
  if (access && access.expires - Date.now() > 60_000) return access.token;
  const clientId = await storedClientId();
  const refreshToken = await SecureStore.getItemAsync(K_REFRESH);
  if (!clientId || !refreshToken) throw new AuthLostError('Not connected to Google Drive.');
  try {
    const t = await AuthSession.refreshAsync({ clientId, refreshToken }, discovery);
    access = { token: t.accessToken, expires: Date.now() + (t.expiresIn ?? 3600) * 1000 };
    if (t.refreshToken) await SecureStore.setItemAsync(K_REFRESH, t.refreshToken);
    return t.accessToken;
  } catch (e) {
    const msg = String(e);
    if (/invalid_grant|unauthorized_client|invalid_client/i.test(msg))
      throw new AuthLostError('Google sign-in has expired. Connect again.');
    throw e;
  }
}

export async function signOut(): Promise<void> {
  const refreshToken = await SecureStore.getItemAsync(K_REFRESH);
  const clientId = await storedClientId();
  if (refreshToken && clientId) {
    try {
      await AuthSession.revokeAsync({ clientId, token: refreshToken }, discovery);
    } catch {
      // Revoking is a courtesy; the token is deleted here either way.
    }
  }
  access = null;
  await SecureStore.deleteItemAsync(K_REFRESH);
  await SecureStore.deleteItemAsync(K_EMAIL);
}

/**
 * Seventeen admin pages call `fetch` directly with the token out of
 * localStorage instead of going through `adminApi`, so the axios 401
 * interceptor never sees them. When an account is revoked mid-session those
 * pages would sit there retrying with a dead token, still showing whatever
 * data was already on screen.
 *
 * This patches `window.fetch` once so every one of them reacts. It fires only
 * on the explicit `X-Access-Revoked` header the API sets when it refuses a
 * pulled token - a bare 401 can mean plenty of innocent things, and signing
 * people out on those would be its own bug.
 */

let installed = false;

export function installAccessRevocationGuard(onRevoked: () => void): void {
  if (installed || typeof window === 'undefined' || !window.fetch) {
    return;
  }
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const response = await originalFetch(...args);

    try {
      if (
        response.status === 401 &&
        response.headers?.get('X-Access-Revoked') === '1' &&
        sessionStorage.getItem('impersonationActive') !== '1'
      ) {
        onRevoked();
      }
    } catch {
      // A guard that throws must not take the caller's request down with it.
    }

    return response;
  };
}

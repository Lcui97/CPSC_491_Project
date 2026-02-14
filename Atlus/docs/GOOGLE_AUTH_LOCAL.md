# Google Sign-In (local development)

You **do not need to deploy** to use Google Auth. It works on localhost.

## Fix 403: "The given origin is not allowed for the given client ID"

This error means the **exact URL** in your browser is not in Google’s allowed list.

### Steps (do this first)

1. Open **[Google Cloud Console](https://console.cloud.google.com/)** and select your project.
2. Go to **APIs & Services** → **Credentials**.
3. Under **OAuth 2.0 Client IDs**, click your **Web application** client (the one whose Client ID is in your `.env`).
4. Under **Authorized JavaScript origins**, click **+ ADD URI** and add **both** of these (one at a time):
   - `http://localhost:5173`
   - `http://127.0.0.1:5173`
   - No trailing slash. Use `http` (not `https`). Port must be `5173` if that’s where Vite runs.
5. If you use a different port (e.g. 5174), add that too, e.g. `http://localhost:5174`.
6. Click **Save**.

Then:

- **Use the same URL when testing**: If you added `http://localhost:5173`, open the app at `http://localhost:5173` (not `http://127.0.0.1:5173` and vice versa), or add both as above.
- Wait a minute for Google’s config to update, then hard-refresh the page (Ctrl+Shift+R or Cmd+Shift+R).

## Fix 401 on api/home and api/refresh

Those usually mean **no valid session**:

- If **Google Sign-In never succeeded** (because of the 403 above), you never get tokens, so the first request to `/api/home` returns 401 and refresh has nothing to use.
- **Quick check**: Log in with **email + password** (register first if needed). If that works and you stay on Home, the backend is fine; the 401s were from missing/invalid tokens while Google was blocked.
- Once Google origin is fixed and you sign in with Google, you should get tokens and stop seeing 401 on `/api/home`.

## Frontend .env

- `frontend/.env` must set `VITE_GOOGLE_CLIENT_ID` to the same **Web client** ID as backend `GOOGLE_CLIENT_ID`.
- Restart the Vite dev server after changing `.env`.

## Cross-Origin-Opener-Policy (COOP) message

If you see “Cross-Origin-Opener-Policy policy would block the window.postMessage call”, it’s often from the Google script. The Vite config sets a permissive COOP so the Google popup can communicate; if the message persists, fixing the 403 (origin allowed) usually resolves it.

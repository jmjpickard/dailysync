# Chunk 2: Google Calendar Integration - OAuth 2.0 Authentication

**Goal:** Implement the Google OAuth 2.0 flow (specifically for installed applications) to allow users to securely grant the Electron app read-only access to their Google Calendar data.

**Context:** Before fetching calendar events, the app needs user authorization. This involves redirecting the user to Google's consent screen and securely handling the authorization code/tokens. This logic primarily resides in the main process.

**Requirements:**

1.  **Google Cloud Project Setup:**

    - Ensure a Google Cloud Project exists.
    - Enable the "Google Calendar API".
    - Create OAuth 2.0 Credentials for a **Desktop app**.
    - Download the `client_secret.json` file (or copy the Client ID and Client Secret). **Do not commit secrets directly into code.** Store them securely (e.g., environment variables during build, or fetched securely).

2.  **Install Google API Client Library:**

    - `npm install googleapis @google-cloud/local-auth` (or similar official library for handling OAuth with local redirect).

3.  **Main Process Logic (`main.js` or dedicated auth module):**
    - **Initiate Authentication Function:**
      - Create a function `authenticateGoogle()` (or similar).
      - This function will be triggered by a user action (e.g., a "Connect Google Calendar" button in Settings, or automatically on first launch/if unauthenticated).
      - Use `@google-cloud/local-auth` (or equivalent) to:
        - Define the required scope: `https://www.googleapis.com/auth/calendar.readonly` (or `calendar.events.readonly`).
        - Load client secrets (securely).
        - Initiate the local authentication flow. This library typically starts a local server, opens the user's browser to Google's consent screen, and listens for the redirect containing the authorization code.
        - Handle the callback, exchange the code for tokens (access token, refresh token).
    - **Token Storage:**
      - Securely store the obtained credentials (access token, refresh token, expiry date) locally. Use `electron-store` or macOS Keychain via `keytar`. **Do not store tokens in plain text files.** Refresh tokens are crucial for maintaining access without repeated user prompts.
    - **Token Loading/Validation:**
      - Implement a function `loadCredentials()` that attempts to load stored credentials on app startup.
      - Check if an access token exists and is not expired. If expired but a refresh token exists, attempt to refresh the token using the Google API client library. Update stored credentials.
    - **Authentication State:** Maintain a state variable indicating whether the user is authenticated. Communicate this state to the renderer process via IPC if needed (e.g., to update UI elements).
    - **Expose Trigger:** Create an IPC channel (e.g., `invoke('google-auth-start')`) that the renderer process can use to trigger the `authenticateGoogle()` function. Handle potential errors during auth and return success/failure status via IPC.
    - **Client Initialization:** Provide a way to get an authenticated Google API client instance (e.g., `google.auth.OAuth2` client set with credentials) for use in subsequent API calls.

**Acceptance Criteria:**

- A mechanism exists (e.g., button in UI, triggered via IPC) to start the Google authentication flow.
- Clicking the trigger opens the user's default browser to the Google OAuth consent screen.
- After user grants permission, the browser is redirected locally (handled by the auth library).
- Access and refresh tokens are obtained and stored securely (verifiable via logging during dev, or checking storage).
- Subsequent app launches attempt to load stored credentials and refresh the access token if necessary.
- An authenticated Google API client can be initialized using the stored/refreshed credentials.
- Errors during authentication (user denial, network issues) are handled gracefully.

**Technologies:** Electron (Main Process), Node.js, `googleapis`, `@google-cloud/local-auth`, `electron-store` or `keytar`, IPC.

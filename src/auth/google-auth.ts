// src/auth/google-auth.ts

import { google, calendar_v3 } from "googleapis";
import { authenticate } from "@google-cloud/local-auth";
import path from "path";
import fs from "fs";
import ElectronStore from "electron-store";
import { BrowserWindow } from "electron";
import { OAuth2Client } from "google-auth-library";

// Define types for Google credentials
interface GoogleCredentials {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  expiry_date?: number;
}

interface ClientSecrets {
  installed?: {
    client_id: string;
    client_secret: string;
    redirect_uris?: string[];
  };
  web?: {
    client_id: string;
    client_secret: string;
    redirect_uris?: string[];
  };
}

// Define the scopes required for Calendar access (read-only)
const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];

// Define store schema
interface StoreSchema {
  googleCredentials?: GoogleCredentials;
}

// Instantiate using 'Store'
const store = new ElectronStore<StoreSchema>({
  name: "google_credentials", // Making it slightly more specific
});

// Path where client secrets would be stored (not committed to git)
// In production, this would be handled more securely
const CREDENTIALS_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE || "",
  ".daily-sync", // Consider using app.getPath('userData') for platform-agnostic path
  "client_secret.json"
);

// Create directory if it doesn't exist
// Check existence *before* trying to create
const secretsDir = path.dirname(CREDENTIALS_PATH);
if (!fs.existsSync(secretsDir)) {
  try {
    fs.mkdirSync(secretsDir, { recursive: true });
    console.log(`Created secrets directory: ${secretsDir}`);
  } catch (err) {
    console.error(`Error creating secrets directory: ${secretsDir}`, err);
    // Handle error appropriately - maybe the app can't proceed?
  }
}

/**
 * Initiates the Google OAuth authentication flow
 * Opens a browser window for user consent, handles the redirect,
 * and stores the resulting tokens
 */
export async function authenticateGoogle(): Promise<boolean> {
  // Ensure the client_secret.json file exists before attempting auth
  console.log(`Expecting client_secret.json at: ${CREDENTIALS_PATH}`);
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error(
      `CRITICAL ERROR: Cannot authenticate. Missing credentials file at ${CREDENTIALS_PATH}`
    );
    // Optional: Notify the renderer process to show a user-friendly error
    // e.g., mainWindow.webContents.send('auth-error', 'Missing configuration file.');
    return false;
  }

  try {
    console.log(`Attempting authentication using keyfile: ${CREDENTIALS_PATH}`);
    // Use the Google Cloud local auth library to handle the OAuth flow
    const auth = await authenticate({
      scopes: SCOPES,
      keyfilePath: CREDENTIALS_PATH, // Path to your client_secret.json
    });

    console.log("Authentication successful via local-auth.");

    // Extract the tokens and expiry
    // Ensure credentials exist before accessing properties
    if (auth && auth.credentials) {
      const credentials: GoogleCredentials = {
        access_token: auth.credentials.access_token ?? undefined,
        refresh_token: auth.credentials.refresh_token ?? undefined,
        expiry_date: auth.credentials.expiry_date ?? undefined,
        // Also store scopes, token_type if needed
        token_type: auth.credentials.token_type ?? undefined,
        scope: auth.credentials.scope,
      };

      // Store credentials securely
      storeCredentials(credentials);
      console.log("Credentials obtained and stored.");
      return true; // Indicate success
    } else {
      console.error(
        "Authentication flow completed but no credentials received."
      );
      return false; // Indicate failure
    }
  } catch (error) {
    console.error("Authentication failed:", error);
    // Add more specific error handling if possible
    // e.g., check for file not found errors for CREDENTIALS_PATH
    return false; // Indicate failure
  }
}

/**
 * Stores OAuth credentials securely using electron-store
 */
function storeCredentials(credentials: GoogleCredentials): void {
  try {
    store.set("googleCredentials", credentials);
    console.log("Credentials stored successfully via electron-store.");
  } catch (error) {
    console.error(
      "Failed to store credentials:",
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Loads stored credentials and refreshes the token if needed
 * Returns an authenticated OAuth2 client or null if not authenticated
 */
export async function loadCredentials(): Promise<OAuth2Client | null> {
  try {
    // Try to load stored credentials
    const credentials: GoogleCredentials | undefined =
      store.get("googleCredentials");

    if (
      !credentials ||
      !credentials.access_token ||
      !credentials.refresh_token
    ) {
      console.log("No valid stored credentials found.");
      return null;
    }

    // Create a new OAuth2 client - Need client ID/Secret from credentials file again for this
    // It's better practice to initialize the client once with secrets and then just set credentials
    let clientSecrets: ClientSecrets | null = null;
    try {
      const content = fs.readFileSync(CREDENTIALS_PATH, "utf8");
      clientSecrets = JSON.parse(content) as ClientSecrets;
    } catch (err) {
      console.error(
        `Failed to read or parse credentials file at ${CREDENTIALS_PATH} for client init.`,
        err
      );
      return null; // Cannot proceed without client secrets
    }

    // Ensure secrets format is as expected
    const secrets = clientSecrets.installed || clientSecrets.web; // Adjust based on your credential type
    if (!secrets || !secrets.client_id || !secrets.client_secret) {
      console.error(`Invalid format in credentials file: ${CREDENTIALS_PATH}`);
      return null;
    }

    const oAuth2Client = new google.auth.OAuth2(
      secrets.client_id,
      secrets.client_secret,
      secrets.redirect_uris ? secrets.redirect_uris[0] : undefined // Redirect URI might be needed
    );

    // Set the stored credentials
    oAuth2Client.setCredentials(credentials);

    // Check if access token is expired (add a small buffer, e.g., 5 minutes)
    const bufferMilliseconds = 5 * 60 * 1000;
    if (
      credentials.expiry_date &&
      Date.now() + bufferMilliseconds > credentials.expiry_date
    ) {
      console.log("Access token expired or nearing expiry, refreshing...");

      try {
        // Refresh the token
        const { credentials: newTokens } =
          await oAuth2Client.refreshAccessToken();
        console.log("Token refreshed successfully.");

        // Store the updated credentials (merge to keep refresh token if it wasn't returned)
        const updatedCredentials: GoogleCredentials = {
          ...credentials, // Keep old values like refresh_token if not in newTokens
          access_token: newTokens.access_token ?? undefined,
          expiry_date: newTokens.expiry_date ?? undefined,
          // Update token_type, scope if they changed
          token_type: newTokens.token_type || credentials.token_type,
          scope: newTokens.scope || credentials.scope,
        };

        // Important: Set the new credentials back onto the client instance!
        oAuth2Client.setCredentials(updatedCredentials);
        storeCredentials(updatedCredentials);
      } catch (refreshError) {
        const error = refreshError as Error & { response?: { data: any } };
        console.error(
          "Error refreshing access token:",
          error.response ? error.response.data : error.message
        );
        // If refresh fails (e.g., token revoked), sign the user out
        signOut();
        return null;
      }
    } else {
      console.log("Existing access token is valid.");
    }

    return oAuth2Client; // Return the authenticated client
  } catch (error) {
    console.error(
      "Error loading or validating credentials:",
      error instanceof Error ? error.message : String(error)
    );
    // Consider signing out if loading fails critically
    // signOut();
    return null;
  }
}

/**
 * Checks if the user is authenticated by trying to load credentials
 */
export async function isAuthenticated(): Promise<boolean> {
  console.log("Checking authentication status...");
  const auth = await loadCredentials();
  const authenticated = !!auth;
  console.log(`User is ${authenticated ? "" : "not "}authenticated.`);
  return authenticated;
}

/**
 * Returns an authenticated Google API client instance for the Calendar API
 */
export async function getCalendarClient(): Promise<calendar_v3.Calendar | null> {
  console.log("Attempting to get Calendar client...");
  const auth = await loadCredentials(); // This handles loading/refreshing
  if (!auth) {
    console.log("Cannot get Calendar client: User not authenticated.");
    return null;
  }
  console.log("Authenticated client obtained, creating Calendar API instance.");
  return google.calendar({ version: "v3", auth });
}

/**
 * Sign out by removing stored credentials
 */
export function signOut(): boolean {
  try {
    store.delete("googleCredentials");
    console.log("User signed out, credentials deleted.");
    // Optionally notify renderer process about sign out
    // e.g., mainWindow.webContents.send('user-signed-out');
    return true;
  } catch (error) {
    console.error(
      "Error deleting credentials during sign out:",
      error instanceof Error ? error.message : String(error)
    );
    return false;
  }
}

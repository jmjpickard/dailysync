# Google Calendar Authentication Module

This module handles the OAuth 2.0 authentication flow to securely connect to Google Calendar.

## Setup Instructions

1. Create a Google Cloud Project:
   - Go to the [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the Google Calendar API
   - Create OAuth 2.0 credentials for a Desktop app
   - Set appropriate redirect URIs (typically http://localhost)

2. Store Your Credentials:
   - Once you have your credentials, create a file named `client_secret.json` at `~/.daily-sync/client_secret.json`
   - Use the format shown in `client_secret.example.json`
   - DO NOT commit your actual credentials to the repository

## Usage

The authentication module provides the following functions:

- `authenticateGoogle()`: Initiates the OAuth flow
- `loadCredentials()`: Loads stored credentials and refreshes tokens if needed
- `isAuthenticated()`: Checks if the user is authenticated
- `getCalendarClient()`: Returns an authenticated Google Calendar API client
- `signOut()`: Removes stored credentials

These functions are exposed through IPC channels in the main process:

- `google-auth-start`: Triggers the OAuth flow
- `google-auth-check`: Checks authentication status
- `google-auth-signout`: Signs out and removes credentials
- `google-auth-state-changed`: Event sent when auth state changes

## Security Notes

- Credentials are stored securely using electron-store
- The access token and refresh token are encrypted
- We recommend using keytar for production environments to leverage the system keychain
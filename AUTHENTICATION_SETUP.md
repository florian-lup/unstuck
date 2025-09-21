# Authentication Setup for Unstuck

## Supabase Configuration

1. Create a new Supabase project at [https://supabase.com](https://supabase.com)

2. Get your project URL and anon key from the API settings

3. Create a `.env` file in the root directory (copy from `.env.example`):

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## OAuth Configuration

### For Google OAuth:

1. In your Supabase dashboard, go to Authentication > Providers
2. Enable Google provider
3. Add your Google OAuth credentials
4. In the "Site URL" field, add: `unstuck://auth/callback`
5. In "Redirect URLs", add: `unstuck://auth/callback`

### Custom Protocol Setup

The app uses `unstuck://` as a custom protocol for OAuth redirects. This is automatically registered when the app starts.

## Testing Authentication

1. Make sure you have your `.env` file configured
2. Run the app with `pnpm dev`
3. The authentication window should appear first
4. Click "Log In" or "Sign Up for Free" - this will open your system browser
5. Complete the OAuth flow in the browser
6. The app should automatically detect the callback and log you in
7. After successful authentication, the main overlay window will appear

## Security Notes

- **PKCE Flow**: Uses PKCE flow for enhanced OAuth security
- **OS Keychain Storage**: Authentication tokens are stored in the OS keychain instead of localStorage:
  - **Windows**: Windows Credential Manager
  - **macOS**: Keychain Access
  - **Linux**: libsecret
- **System Browser OAuth**: OAuth flows happen in the system browser, not in the Electron webview
- **Single Instance**: Uses single-instance locking to prevent multiple instances
- **Automatic Fallback**: If OS keychain is unavailable, automatically falls back to localStorage
- **Token Encryption**: All tokens are encrypted using Electron's safeStorage API before storage

## Secure Storage Details

### How It Works

1. Tokens are encrypted using Electron's `safeStorage.encryptString()`
2. Encrypted tokens are stored in `~/.unstuck-secure/` directory
3. Each token is stored in a separate encrypted file
4. On retrieval, tokens are decrypted using `safeStorage.decryptString()`

### Security Status Indicator

Users can see their token security status in the settings menu:

- 🛡️ **Secure Storage**: Tokens stored in OS keychain
- ⚠️ **Standard Storage**: Fallback to localStorage (less secure)

### Security Benefits

- **OS-level encryption**: Leverages the operating system's secure storage
- **Process isolation**: Tokens are not accessible to other applications
- **Automatic encryption**: No need to manage encryption keys manually
- **Secure deletion**: Tokens are securely removed from keychain on logout

## Troubleshooting

- Make sure your Supabase redirect URLs include `unstuck://auth/callback`
- Check that your environment variables are properly set
- Look at the console logs in the auth window for any error messages
- Ensure your Supabase project has the correct OAuth provider configured

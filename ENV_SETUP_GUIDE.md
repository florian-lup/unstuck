# 🔧 Environment Variables Setup Guide

## The Issue

Your dev server won't start because it's missing Supabase environment variables. The app is looking for a `.env` file with your Supabase credentials.

## 📋 Quick Setup Steps

### Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in
3. Click **"New Project"**
4. Choose your organization
5. Enter project details:
   - **Name**: `unstuck-auth` (or any name you prefer)
   - **Database Password**: Create a strong password
   - **Region**: Choose closest to you
6. Click **"Create new project"**
7. Wait for project to initialize (2-3 minutes)

### Step 2: Get Your API Credentials

1. In your Supabase dashboard, click **Settings** (gear icon)
2. Click **API** in the left sidebar
3. You'll see two important values:
   - **Project URL** (looks like: `https://abcdefghijklmn.supabase.co`)
   - **anon public key** (long string starting with `eyJ...`)

### Step 3: Create .env File

1. In your project root (same folder as `package.json`), create a file called `.env`
2. Copy and paste this template:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

3. Replace the values:
   - Replace `https://your-project-id.supabase.co` with your actual **Project URL**
   - Replace `your-anon-key-here` with your actual **anon public key**

### Step 4: Configure OAuth (for Google login)

1. In Supabase dashboard, go to **Authentication** > **Providers**
2. Find **Google** and click to configure
3. Enable the Google provider
4. You'll need Google OAuth credentials:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Add `unstuck://auth/callback` to authorized redirect URIs
5. Add your Google credentials to Supabase
6. In **Site URL** field, add: `unstuck://auth/callback`
7. In **Redirect URLs** field, add: `unstuck://auth/callback`

## ✅ Test Your Setup

After creating your `.env` file, try running:

```bash
pnpm dev
```

You should see:

```
✅ Environment configuration loaded securely in main process
🔒 AuthService initialized in main process
```

## 🔒 Security Notes

- ✅ **Your `.env` file is safe** - it's only loaded in the main process
- ✅ **Never commit `.env`** - it's already in `.gitignore`
- ✅ **Only anon key is used** - no service role key needed
- ✅ **Tokens stored securely** - in OS keychain, not localStorage

## 🐛 Troubleshooting

### Error: "Missing Supabase configuration"

- Check that your `.env` file exists in the project root
- Verify the variable names are exactly `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Make sure there are no spaces around the `=` sign
- Ensure the file is saved

### Error: "AuthService initialization failed"

- Check that your Project URL is correct and accessible
- Verify your anon key is correct (should be a long JWT token)
- Make sure your Supabase project is active

### OAuth Not Working

- Verify `unstuck://auth/callback` is added to redirect URIs
- Check that Google provider is enabled in Supabase
- Ensure your Google OAuth credentials are correct

## 📝 Example .env File

```env
# Real example (with fake values):
VITE_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYzOTU4ODk4MSwiZXhwIjoxOTU1MTY0OTgxfQ.example-signature-here
```

Once you create your `.env` file with the correct values, your dev server should start successfully! 🚀

# 🚀 Production Deployment Guide

## ❌ **DON'T Commit .env Files**

**Never commit your `.env` file to version control!** I've added it to `.gitignore` to protect your credentials.

## 🔐 **How Electron Production Works**

Unlike web apps, Electron apps are **packaged and distributed**, so the deployment strategy is different:

### **Development vs Production**

```typescript
// Your env-loader.ts automatically handles this:

// 🔧 DEVELOPMENT (loads from .env file)
if (process.env.NODE_ENV === 'development') {
  // Reads from .env file ✅
}

// 🏭 PRODUCTION (uses build-time variables)
return {
  supabaseUrl: process.env.VITE_SUPABASE_URL, // From build environment
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY, // From build environment
}
```

## 🏗️ **Production Build Options**

### **Option 1: Build-Time Environment Variables (Recommended)**

Set environment variables when building your app:

```bash
# Windows
set VITE_SUPABASE_URL=https://your-project.supabase.co
set VITE_SUPABASE_ANON_KEY=your-anon-key
pnpm build

# macOS/Linux
export VITE_SUPABASE_URL=https://your-project.supabase.co
export VITE_SUPABASE_ANON_KEY=your-anon-key
pnpm build
```

### **Option 2: CI/CD Secrets (Best for Teams)**

If using GitHub Actions, Vercel, or similar:

```yaml
# .github/workflows/build.yml
- name: Build Electron App
  env:
    VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
    VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
  run: pnpm build
```

### **Option 3: Runtime Configuration (Advanced)**

For enterprise deployments, you could load config at runtime:

```typescript
// Load from system environment or config file
const config = {
  supabaseUrl: process.env.SUPABASE_URL || loadFromConfigFile(),
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || loadFromConfigFile(),
}
```

## 🔒 **Security Considerations**

### **✅ Safe to Include in Electron App:**

- **Supabase Project URL** - This is meant to be public
- **Supabase Anon Key** - This is the "public" key, designed for client-side use
- **Redirect URIs** - These are already known

### **❌ NEVER Include:**

- **Supabase Service Role Key** - Server-only, never in client apps
- **Database passwords** - Should never leave your Supabase dashboard
- **Private API keys** - Keep these on your backend only

## 📦 **Electron App Distribution**

When you build your Electron app:

```bash
pnpm build  # Creates packaged app with embedded credentials
```

The built app will contain:

- ✅ **Encrypted in the bundle** - Credentials are part of the compiled code
- ✅ **OS-level protection** - App files are protected by OS permissions
- ✅ **No network exposure** - Unlike web apps, no public access to source

## 🛡️ **Additional Security for Production**

### **1. Key Rotation Strategy**

```bash
# If keys are compromised, rotate them:
# 1. Generate new anon key in Supabase dashboard
# 2. Update environment variables
# 3. Rebuild and redistribute app
```

### **2. Environment-Specific Keys**

```bash
# Use different Supabase projects for different environments
VITE_SUPABASE_URL_DEV=https://dev-project.supabase.co
VITE_SUPABASE_URL_PROD=https://prod-project.supabase.co
```

### **3. Code Signing**

```bash
# Sign your Electron app to prevent tampering
# This ensures users get the authentic version
```

## 🎯 **Recommended Workflow**

### **For Solo Development:**

1. Keep `.env` file local (never commit)
2. Set environment variables when building for production
3. Distribute the built app

### **For Team Development:**

1. Share environment variables through secure channels (1Password, etc.)
2. Use CI/CD secrets for automated builds
3. Each developer has their own `.env` file
4. Use different Supabase projects for dev/staging/prod

## ⚠️ **Common Mistakes to Avoid**

### **❌ DON'T:**

- Commit `.env` files to git
- Include service role keys in Electron apps
- Use production keys in development
- Share keys in plain text (email, Slack, etc.)

### **✅ DO:**

- Use build-time environment variables for production
- Keep development and production keys separate
- Rotate keys if compromised
- Use secure channels for sharing keys

## 🔍 **How to Verify Your Setup**

Check that your `.env` is properly ignored:

```bash
git status
# Should NOT show .env file as untracked
```

Check your production build:

```bash
# Build with environment variables
VITE_SUPABASE_URL=https://your-project.supabase.co VITE_SUPABASE_ANON_KEY=your-key pnpm build

# The built app should work without needing .env file
```

## 📋 **Production Checklist**

- [ ] `.env` added to `.gitignore` ✅
- [ ] Environment variables set in build environment
- [ ] Different Supabase projects for dev/prod (recommended)
- [ ] Build process tested without `.env` file
- [ ] App signed for distribution (optional but recommended)
- [ ] Key rotation plan in place

Your credentials are now properly protected! The `.env` file stays local, and production builds use environment variables. 🔒

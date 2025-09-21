# 🏭 Production Build Setup Guide

## 🎯 **Setting Environment Variables for Production**

Your app is already configured to use environment variables in production. Now let's set them up!

---

## 📋 **Step 1: Get Your Production Supabase Credentials**

First, decide if you want to use the same Supabase project or create a separate production project:

### **Option A: Same Project (Simpler)**

- Use your existing Supabase project for both dev and production
- Same credentials, just set them as environment variables

### **Option B: Separate Projects (Recommended)**

- Create a new Supabase project for production
- Keep development and production data separate
- More secure and professional

---

## 🖥️ **Step 2: Set Environment Variables (by Platform)**

### **Windows (Command Prompt)**

```cmd
# Set environment variables
set VITE_SUPABASE_URL=https://your-project-id.supabase.co
set VITE_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.your-key-here

# Build your app
pnpm build
```

### **Windows (PowerShell)**

```powershell
# Set environment variables
$env:VITE_SUPABASE_URL="https://your-project-id.supabase.co"
$env:VITE_SUPABASE_ANON_KEY="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.your-key-here"

# Build your app
pnpm build
```

### **macOS/Linux (Terminal)**

```bash
# Set environment variables
export VITE_SUPABASE_URL=https://your-project-id.supabase.co
export VITE_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.your-key-here

# Build your app
pnpm build
```

### **One-Line Build (All Platforms)**

```bash
# Windows (cmd)
set VITE_SUPABASE_URL=https://your-project.supabase.co && set VITE_SUPABASE_ANON_KEY=your-key && pnpm build

# Windows (PowerShell)
$env:VITE_SUPABASE_URL="https://your-project.supabase.co"; $env:VITE_SUPABASE_ANON_KEY="your-key"; pnpm build

# macOS/Linux
VITE_SUPABASE_URL=https://your-project.supabase.co VITE_SUPABASE_ANON_KEY=your-key pnpm build
```

---

## 🛠️ **Step 3: Create Build Scripts**

Add production build scripts to your `package.json`:

### **Update package.json**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build && electron-builder",
    "build:prod": "cross-env NODE_ENV=production pnpm build",
    "build:win": "cross-env VITE_SUPABASE_URL=%PROD_SUPABASE_URL% VITE_SUPABASE_ANON_KEY=%PROD_SUPABASE_KEY% pnpm build",
    "build:unix": "cross-env VITE_SUPABASE_URL=$PROD_SUPABASE_URL VITE_SUPABASE_ANON_KEY=$PROD_SUPABASE_KEY pnpm build"
  }
}
```

### **Install cross-env for cross-platform support:**

```bash
pnpm add -D cross-env
```

---

## 🔧 **Step 4: Create Environment-Specific Scripts**

### **Create build-prod.bat (Windows)**

```bat
@echo off
echo Building Unstuck for Production...

REM Set your production Supabase credentials
set VITE_SUPABASE_URL=https://your-prod-project.supabase.co
set VITE_SUPABASE_ANON_KEY=your-production-anon-key

REM Build the app
echo Setting environment variables...
echo VITE_SUPABASE_URL=%VITE_SUPABASE_URL%
echo Building app...
pnpm build

echo Build complete! Check the dist/ folder.
pause
```

### **Create build-prod.sh (macOS/Linux)**

```bash
#!/bin/bash
echo "Building Unstuck for Production..."

# Set your production Supabase credentials
export VITE_SUPABASE_URL=https://your-prod-project.supabase.co
export VITE_SUPABASE_ANON_KEY=your-production-anon-key

# Build the app
echo "Setting environment variables..."
echo "VITE_SUPABASE_URL=$VITE_SUPABASE_URL"
echo "Building app..."
pnpm build

echo "Build complete! Check the dist/ folder."
```

Make it executable:

```bash
chmod +x build-prod.sh
```

---

## 🧪 **Step 5: Test Your Production Build**

### **Verify Environment Variables Are Set**

Create a test script to verify:

```javascript
// test-env.js
console.log('Environment Variables:')
console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL)
console.log(
  'VITE_SUPABASE_ANON_KEY:',
  process.env.VITE_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET'
)
```

Run it:

```bash
# After setting your environment variables
node test-env.js
```

### **Test the Built App**

1. Build your app with production environment variables
2. Run the built executable
3. Check that authentication works
4. Verify no errors in the console

---

## ⚙️ **Step 6: Automated Build Setup**

### **Create .env.production (Template Only - Don't Commit)**

```env
# .env.production (for reference only - set actual values as environment variables)
VITE_SUPABASE_URL=https://your-production-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-production-anon-key
```

### **GitHub Actions Example**

```yaml
# .github/workflows/build.yml
name: Build Electron App
on: [push, pull_request]

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: pnpm install

      - name: Build for production
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
        run: pnpm build

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: electron-app
          path: dist/
```

---

## 🔍 **Troubleshooting**

### **"Missing Supabase configuration" Error**

```bash
# Check if variables are set
echo $VITE_SUPABASE_URL        # macOS/Linux
echo %VITE_SUPABASE_URL%       # Windows CMD
echo $env:VITE_SUPABASE_URL    # Windows PowerShell
```

### **Variables Not Persisting**

- Environment variables only last for the current session
- Set them right before building, or use the build scripts
- For permanent setup, add to your shell profile (.bashrc, .zshrc, etc.)

### **Build Fails**

- Make sure you have the exact variable names: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Check that your Supabase credentials are valid
- Verify your .env file works locally first

---

## ✅ **Quick Test Commands**

### **Test 1: Verify Environment Variables**

```bash
# Set variables (use your actual values)
# Windows CMD:
set VITE_SUPABASE_URL=https://your-project.supabase.co
set VITE_SUPABASE_ANON_KEY=your-key
echo Variables set: %VITE_SUPABASE_URL%

# macOS/Linux:
export VITE_SUPABASE_URL=https://your-project.supabase.co
export VITE_SUPABASE_ANON_KEY=your-key
echo Variables set: $VITE_SUPABASE_URL
```

### **Test 2: Production Build**

```bash
# After setting variables above
pnpm build

# Should see:
# ✅ Environment configuration loaded securely in main process
# 🔒 AuthService initialized in main process
```

### **Test 3: Run Built App**

```bash
# Windows
.\dist\unstuck.exe

# macOS
./dist/Unstuck.app/Contents/MacOS/Unstuck

# Linux
./dist/unstuck
```

---

## 🎉 **You're Ready!**

Now you can build production versions of your app with secure environment variables. The built app will have your Supabase credentials embedded securely and won't need any `.env` file.

**Next time you want to build for production:**

1. Set your environment variables
2. Run `pnpm build`
3. Distribute the built app

Your production setup is now complete! 🚀

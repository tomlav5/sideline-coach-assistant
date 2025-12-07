# Dev Environment Performance Optimization

## Quick Fixes (Try These First!)

### 1. **Clear Node Modules & Reinstall** ⚡ (Often fixes 80% of issues)
```bash
rm -rf node_modules
npm cache clean --force
npm install
```

### 2. **Increase Node Memory Limit**
```bash
# Add to your shell profile (~/.zshrc or ~/.bashrc)
export NODE_OPTIONS="--max-old-space-size=4096"

# Or run dev server with:
NODE_OPTIONS="--max-old-space-size=4096" npm run dev
```

### 3. **Disable Component Tagger in Dev** (Already done in vite.config.ts)
The `lovable-tagger` is only running in development mode, which is good.

### 4. **Close Unnecessary Browser Tabs & Dev Tools**
- Close React Dev Tools when not debugging
- Close other browser tabs
- Disable unnecessary browser extensions

### 5. **Use Production Build for Testing**
If you just want to test features (not develop):
```bash
npm run build
npm run preview
```
This will be much faster!

---

## Optimization Applied to vite.config.ts

I've updated your Vite config with performance optimizations:

### What's Been Added:
✅ **CSS Code Splitting** - Faster loading
✅ **Chunk Size Warnings** - Disabled for dev
✅ **Source Maps** - Optimized for dev
✅ **File System Optimization** - Better caching
✅ **Dependency Pre-bundling** - Explicit includes
✅ **Build Optimizations** - Tree shaking, minification

---

## System-Level Fixes

### Check Node Version
```bash
node --version  # Should be v18+ for best performance
```

If you're on an old version:
```bash
# Install latest LTS
nvm install --lts
nvm use --lts
```

### Check Available Memory
```bash
# On macOS
vm_stat | perl -ne '/page size of (\d+)/ and $size=$1; /Pages\s+([^:]+)[^\d]+(\d+)/ and printf("%-16s % 16.2f MB\n", "$1:", $2 * $size / 1048576);'
```

If memory is low, close other applications.

---

## Project-Specific Optimizations

### Reduce HMR (Hot Module Reload) Overhead

**Option 1: Disable HMR for Large Files**
Add to `vite.config.ts`:
```ts
server: {
  hmr: {
    overlay: false,  // Disable error overlay if it's causing issues
  },
  watch: {
    ignored: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
  },
},
```

**Option 2: Use Full Page Reload Instead of HMR**
In browser, disable "Hot Reload" in React Dev Tools.

---

## Database Connection Issues

If Supabase queries are slow:

### 1. Check Network
```bash
ping supabase.co
```

### 2. Use Local Supabase (Optional)
```bash
npx supabase start  # Runs local database
# Update .env to point to local URL
```

### 3. Add Query Caching
Already using React Query with good stale times - ✅ OK

---

## Monitoring Performance

### Check Build Time
```bash
npm run build -- --debug
```

### Check Dev Server Performance
```bash
DEBUG=vite:* npm run dev
```

### Profile in Browser
1. Open Chrome DevTools
2. Performance tab
3. Click Record
4. Navigate app
5. Stop recording
6. Check what's slow

---

## Common Slow Patterns to Avoid

### ❌ Don't:
```tsx
// Re-renders entire list on every change
{items.map(item => <Component key={Math.random()} item={item} />)}
```

### ✅ Do:
```tsx
// Stable keys, proper memoization
{items.map(item => <Component key={item.id} item={item} />)}
```

---

## Testing Performance

### Before Optimization:
1. Measure page load time
2. Measure HMR update time
3. Measure navigation speed

### After Optimization:
Run same tests and compare!

---

## Recommended: Test with Production Build

For testing your new editing features, use production mode:

```bash
# Build once
npm run build

# Serve built files (fast!)
npm run preview
```

**Why?**
- No HMR overhead
- Optimized bundles
- Minified code
- Tree-shaken
- Much faster!

You can still test all features, just can't edit code.

---

## Emergency Nuclear Option 🚨

If nothing works:

```bash
# 1. Backup your .env file
cp .env .env.backup

# 2. Delete everything except source
rm -rf node_modules
rm -rf .vite
rm -rf dist
rm package-lock.json

# 3. Reinstall
npm install

# 4. Restore .env
cp .env.backup .env

# 5. Start fresh
npm run dev
```

---

## Expected Performance

### Good Performance:
- **Dev server start**: 2-5 seconds
- **HMR update**: <500ms
- **Page navigation**: <200ms
- **Build time**: 10-30 seconds

### If Slower:
Something needs fixing!

---

## Quick Diagnostic Script

Run this to check your setup:

```bash
echo "Node version:" && node --version
echo "NPM version:" && npm --version
echo "Memory:" && vm_stat | head -4
echo "Disk space:" && df -h . | tail -1
echo "node_modules size:" && du -sh node_modules 2>/dev/null || echo "Not installed"
```

---

## For Testing Your New Features

**Recommended approach:**

```bash
# 1. Build production version
npm run build

# 2. Start preview server (super fast!)
npm run preview

# 3. Test editing features in browser
open http://localhost:4173
```

This gives you:
- ✅ Fast performance
- ✅ All features working
- ✅ Real production behavior
- ❌ Can't edit code (but you're just testing!)

When you need to make code changes, go back to `npm run dev`.

---

## Next Steps

1. Try the Quick Fixes above
2. If still slow, run the diagnostic script
3. Consider using `npm run build && npm run preview` for testing
4. Report back what helped!

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Use absolute base for web deployment
  base: '/',
  server: {
    host: "::",
    port: 8080,
    // Performance: Reduce HMR overhead
    hmr: {
      overlay: true,
    },
    // Performance: Optimize file watching
    watch: {
      ignored: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
      usePolling: false,
    },
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Performance: Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
      '@tanstack/react-query',
    ],
    exclude: ['lovable-tagger'],
  },
  // Performance: Build optimizations
  build: {
    // Reduce chunk size warnings
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-select', '@radix-ui/react-popover'],
          'supabase': ['@supabase/supabase-js'],
          'query': ['@tanstack/react-query'],
        },
      },
    },
    // Enable source maps only in dev
    sourcemap: mode === 'development' ? 'inline' : false,
    // Minify in production
    minify: mode === 'production' ? 'esbuild' : false,
  },
  // Performance: Disable certain checks in dev
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' },
  },
}));
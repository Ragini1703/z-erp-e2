import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react({
      // Optimize dependencies
      babel: {
        plugins: [
          // Add any babel plugins here if needed
        ],
      },
    }),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "..", "backend", "shared"),
      "@assets": path.resolve(import.meta.dirname, "..", "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  envDir: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
   // Optimize chunk splitting
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunks - handle in priority order
          if (id.includes('node_modules')) {
            // Core React only (no dependencies on other vendors)
            if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('scheduler')) {
              return 'react-vendor';
            }
            // React ecosystem libraries that don't depend on react
            if (id.includes('react-hook-form') || id.includes('@hookform')) {
              return 'forms-vendor';
            }
            // UI libraries
            if (id.includes('@radix-ui')) {
              return 'ui-vendor';
            }
            // Icons
            if (id.includes('lucide-react')) {
              return 'icons-vendor';
            }
            // Utility libraries
            if (id.includes('date-fns') || id.includes('clsx') || id.includes('tailwind-merge')) {
              return 'utils-vendor';
            }
            // Charts
            if (id.includes('recharts')) {
              return 'charts-vendor';
            }
            // PDF libraries
            if (id.includes('jspdf') || id.includes('autotable')) {
              return 'pdf-vendor';
            }
            // Excel libraries
            if (id.includes('xlsx') || id.includes('jszip')) {
              return 'excel-vendor';
            }
            // HTML to PDF/Canvas
            if (id.includes('html2pdf') || id.includes('html2canvas')) {
              return 'html2canvas.esm';
            }
            // DOMPurify
            if (id.includes('dompurify') || id.includes('purify')) {
              return 'purify.es';
            }
            // All other node_modules
            return 'vendor';
          }
          
          // Split large application pages
          if (id.includes('/pages/hrm/')) {
            return 'hrm-pages';
          }
          if (id.includes('/pages/leads/')) {
            return 'leads-pages';
          }
          if (id.includes('/pages/attendance/')) {
            return 'attendance-pages';
          }
          if (id.includes('/pages/profile/')) {
            return 'profile-pages';
          }
          if (id.includes('/pages/recruitment/')) {
            return 'recruitment-pages';
          }
          if (id.includes('/pages/settings/')) {
            return 'settings-pages';
          }
          if (id.includes('/components/ui/')) {
            return 'ui-components';
          }
        },
      },
    },
    // Enable source maps for debugging
    sourcemap: process.env.NODE_ENV !== 'production',
    // Optimize chunk size - increased limit after code splitting
    chunkSizeWarningLimit: 1500,
    // Minification options
    minify: 'esbuild',
    target: 'esnext',
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'wouter',
      '@tanstack/react-query',
      'lucide-react',
      'date-fns',
      'recharts',
      'jspdf',
      'xlsx',
    ],
    exclude: [],
  },
  server: {
    port: 5176,
    // Enable HMR
    hmr: {
      overlay: true,
    },
    // Warm up frequently used files
    warmup: {
      clientFiles: [
        './client/src/App.tsx',
        './client/src/main.tsx',
        './client/src/pages/**/*.tsx',
      ],
    },
    proxy: {
      "/api": {
        target: "http://localhost:5001",
        changeOrigin: true,
      },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});

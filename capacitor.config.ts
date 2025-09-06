import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.e7fbe748a8d14a16bfa929648a8fa146',
  appName: 'sideline-assist',
  webDir: 'dist',
  server: {
    url: 'https://e7fbe748-a8d1-4a16-bfa9-29648a8fa146.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  bundledWebRuntime: false
};

export default config;
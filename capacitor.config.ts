import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yourorg.sidelinecoach',
  appName: 'SideLine Coach Assistant',
  webDir: 'dist',
  server: {
    url: 'http://YOUR_LAN_IP:5173',
    cleartext: true,
  },
};

export default config;
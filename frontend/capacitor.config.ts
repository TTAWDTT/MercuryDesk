import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.ttawdtt.aelin",
  appName: "Aelin",
  webDir: "dist",
  server: {
    // Use http in Android shell to avoid mixed-content blocks when backend runs on local http.
    androidScheme: "http",
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false,
    },
  },
};

export default config;

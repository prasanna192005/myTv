import type { NextConfig } from "next";
import os from "os";

// Helper to gather all local IPv4 network addresses on startup
function getLocalIps(): string[] {
  const ips: string[] = [];
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      const iface = interfaces[name];
      if (iface) {
        for (const alias of iface) {
          if (alias.family === "IPv4") {
            ips.push(alias.address);
          }
        }
      }
    }
  } catch (e) {
    console.error("Failed to detect network interfaces for dev origins:", e);
  }
  return ips;
}

const localIps = getLocalIps();

const nextConfig: NextConfig = {
  // Automatically authorize network connections for dev hot reloads (HMR)
  allowedDevOrigins: [...localIps, "localhost", "127.0.0.1"],
};

export default nextConfig;

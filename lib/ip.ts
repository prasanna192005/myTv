import os from 'os';

export function getLocalIp(): string {
  const interfaces = os.networkInterfaces();
  const candidates: { name: string; address: string }[] = [];

  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (iface) {
      for (const alias of iface) {
        if (alias.family === 'IPv4' && !alias.internal) {
          candidates.push({ name, address: alias.address });
        }
      }
    }
  }

  if (candidates.length === 0) {
    return '127.0.0.1';
  }

  // Filter out known virtual interfaces (Hyper-V, WSL, VMware, VirtualBox, Docker, VPNs)
  const physicalCandidates = candidates.filter((c) => {
    const lowerName = c.name.toLowerCase();
    const isVirtual =
      lowerName.includes('virtual') ||
      lowerName.includes('vbox') ||
      lowerName.includes('vmware') ||
      lowerName.includes('wsl') ||
      lowerName.includes('hyper-v') ||
      lowerName.includes('docker') ||
      lowerName.includes('vpn') ||
      lowerName.includes('host-only');
    return !isVirtual;
  });

  // Prioritize physical Wi-Fi or Ethernet adapters
  if (physicalCandidates.length > 0) {
    const wifiOrEthernet = physicalCandidates.find((c) => {
      const lowerName = c.name.toLowerCase();
      return lowerName.includes('wi-fi') || lowerName.includes('wifi') || lowerName.includes('ethernet');
    });
    if (wifiOrEthernet) {
      return wifiOrEthernet.address;
    }
    return physicalCandidates[0].address;
  }

  // Fallback to the first detected address
  return candidates[0].address;
}

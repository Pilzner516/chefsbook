const { withAndroidManifest } = require('expo/config-plugins');
const { mkdirSync, writeFileSync, existsSync } = require('fs');
const { join } = require('path');

/**
 * Expo config plugin that enables cleartext HTTP traffic for the self-hosted
 * Supabase instance on Tailscale (100.83.66.51).
 *
 * Creates network_security_config.xml and sets usesCleartextTraffic + networkSecurityConfig
 * on the Application element in AndroidManifest.xml.
 */
module.exports = function withCleartextTraffic(config) {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults;
    const app = manifest.manifest.application?.[0];
    if (!app) return config;

    // Write network_security_config.xml
    const resXmlDir = join(
      config.modRequest.platformProjectRoot,
      'app', 'src', 'main', 'res', 'xml',
    );
    if (!existsSync(resXmlDir)) mkdirSync(resXmlDir, { recursive: true });

    writeFileSync(
      join(resXmlDir, 'network_security_config.xml'),
      `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">100.83.66.51</domain>
        <domain includeSubdomains="false">10.0.2.2</domain>
        <domain includeSubdomains="false">localhost</domain>
    </domain-config>
</network-security-config>
`,
    );

    // Set attributes on <application>
    app.$['android:usesCleartextTraffic'] = 'true';
    app.$['android:networkSecurityConfig'] = '@xml/network_security_config';

    return config;
  });
};

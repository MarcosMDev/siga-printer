const { withAndroidManifest, withInfoPlist } = require('@expo/config-plugins');

/**
 * Expo config plugin for siga-printer.
 *
 * Adds required permissions and protocol declarations automatically
 * during `expo prebuild` (bare workflow) or EAS Build.
 *
 * Usage in app.json / app.config.js:
 *   { "expo": { "plugins": ["siga-printer"] } }
 */
function withSigaPrinter(config) {
  config = withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    // USB OTG feature
    if (!manifest['uses-feature']) manifest['uses-feature'] = [];
    if (!manifest['uses-feature'].some(f => f.$?.['android:name'] === 'android.hardware.usb.host')) {
      manifest['uses-feature'].push({
        $: { 'android:name': 'android.hardware.usb.host', 'android:required': 'false' },
      });
    }

    // Bluetooth permissions (Android 12+)
    if (!manifest['uses-permission']) manifest['uses-permission'] = [];
    for (const perm of [
      'android.permission.BLUETOOTH_CONNECT',
      'android.permission.BLUETOOTH_SCAN',
    ]) {
      if (!manifest['uses-permission'].some(p => p.$?.['android:name'] === perm)) {
        manifest['uses-permission'].push({ $: { 'android:name': perm } });
      }
    }

    return cfg;
  });

  config = withInfoPlist(config, (cfg) => {
    // Bluetooth MFi protocol for Epson printers
    const key = 'UISupportedExternalAccessoryProtocols';
    if (!cfg.modResults[key]) cfg.modResults[key] = [];
    if (!cfg.modResults[key].includes('com.epson.escpos')) {
      cfg.modResults[key].push('com.epson.escpos');
    }
    return cfg;
  });

  return config;
}

module.exports = withSigaPrinter;

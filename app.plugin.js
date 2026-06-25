const { withAndroidManifest, withInfoPlist, withProjectBuildGradle } = require('@expo/config-plugins');

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

  // JitPack repository — required for usb-serial-for-android
  config = withProjectBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes('jitpack.io')) {
      cfg.modResults.contents = cfg.modResults.contents.replace(
        /allprojects\s*\{[\s\S]*?repositories\s*\{/,
        (match) => `${match}\n        maven { url 'https://jitpack.io' }`,
      );
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

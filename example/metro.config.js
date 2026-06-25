const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const libraryRoot = path.resolve(__dirname, '..');
const appNodeModules = path.resolve(__dirname, 'node_modules');

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const config = {
  watchFolders: [libraryRoot],
  resolver: {
    // Block only react/react-native from the library's node_modules so Metro
    // falls back up the tree to example/node_modules — single React instance.
    blockList: [
      new RegExp(`^${esc(libraryRoot)}/node_modules/react/.*`),
      new RegExp(`^${esc(libraryRoot)}/node_modules/react-native/.*`),
    ],
    extraNodeModules: {
      'react':        path.resolve(appNodeModules, 'react'),
      'react-native': path.resolve(appNodeModules, 'react-native'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);

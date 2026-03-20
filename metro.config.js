const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Fix asset paths for GitHub Pages subdirectory deployment.
// Without this, fonts load from /assets/... (404) instead of /splitwise/assets/...
const isExport = process.env.EXPO_PUBLIC_BUILDING_FOR_WEB === '1' ||
  process.argv.some(a => a.includes('export'));

if (isExport) {
  config.transformer = {
    ...config.transformer,
    publicPath: '/splitwise/assets',
  };
}

module.exports = config;

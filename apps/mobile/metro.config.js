const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo
config.watchFolders = [monorepoRoot];

// Resolve modules from both the app and the monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Block the root-hoisted react-native to prevent duplicate copies in the bundle.
// Mobile has its own react-native in apps/mobile/node_modules/ which must be the only copy.
const rootRN = path.resolve(monorepoRoot, 'node_modules', 'react-native');
const rootReact = path.resolve(monorepoRoot, 'node_modules', 'react');
const escape = (p) => p.replace(/[\\\/]/g, '[/\\\\]').replace(/\./g, '\\.');
config.resolver.blockList = [
  new RegExp(`^${escape(rootRN)}[/\\\\].*$`),
  new RegExp(`^${escape(rootReact)}[/\\\\].*$`),
];

module.exports = config;

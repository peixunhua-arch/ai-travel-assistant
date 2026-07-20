// Monorepo Metro：release 打包需能解析 pnpm 依赖树。
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 真机/Hermes：whatwg-fetch 会与 RN 0.81 Event 相位常量冲突，改用空 shim。
const whatwgFetchShim = path.resolve(projectRoot, 'shims/whatwg-fetch.js');
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'whatwg-fetch' && platform !== 'web') {
    return { type: 'sourceFile', filePath: whatwgFetchShim };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

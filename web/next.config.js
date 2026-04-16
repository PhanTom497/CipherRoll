/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // @cofhe/sdk uses WASM for TFHE operations
    config.experiments = Object.assign(config.experiments || {}, {
      asyncWebAssembly: true,
      layers: true,
      topLevelAwait: true
    });

    config.optimization.moduleIds = 'named';

    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    });

    if (isServer) {
      config.output.webassemblyModuleFilename = './../static/wasm/tfhe_bg.wasm';
    } else {
      config.output.webassemblyModuleFilename = 'static/wasm/tfhe_bg.wasm';
    }

    // Polyfill buffer for @cofhe/sdk in browser
    if (!isServer) {
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        buffer: false,
        crypto: false,
        stream: false,
        path: false,
        fs: false,
      };
    }

    return config;
  },
}

module.exports = nextConfig

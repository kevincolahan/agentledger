/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep heavy server-only packages out of the client bundle
  experimental: {
    serverComponentsExternalPackages: [
      "@prisma/client",
      "@react-pdf/renderer",
      "@solana/web3.js",
      "tweetnacl",
      "bs58",
    ],
  },

  // Webpack: polyfill Node.js builtins that @solana/web3.js needs
  // These only run server-side in Next.js, but webpack still processes them
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
        buffer: false,
      };
    }
    // Ignore encoding errors from optional packages
    config.ignoreWarnings = [
      { module: /node_modules\/node-fetch/ },
      { module: /node_modules\/@solana/ },
    ];
    return config;
  },
};

module.exports = nextConfig;

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingIncludes: {
    '/api/client-notes': [
      './node_modules/@tesseract.js-data/eng/4.0.0/**/*',
      './node_modules/tesseract.js-core/**/*',
    ],
  },
  allowedDevOrigins: ['127.0.0.1'],
};

export default nextConfig;

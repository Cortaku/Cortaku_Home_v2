/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // A fully static site; Cloudflare serves the ./out folder.
  output: 'export',
  reactCompiler: true,
};

module.exports = nextConfig;
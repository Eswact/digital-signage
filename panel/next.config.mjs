/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Docker imajı için bağımsız sunucu çıktısı (deploy/panel.Dockerfile); dev'i etkilemez.
  output: 'standalone',
};

export default nextConfig;

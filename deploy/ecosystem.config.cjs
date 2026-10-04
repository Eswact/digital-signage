// pm2 alternatifi (systemd yerine). pm2 env dosyası okumaz; değişkenleri
// başlatırken kabuktan verin (repo kökünden):
//   set -a && . /etc/signage/backend.env && set +a
//   pm2 start deploy/ecosystem.config.cjs && pm2 save && pm2 startup
// Derleme adımları için bkz. deploy/README.md.
module.exports = {
  apps: [
    {
      name: 'signage-backend',
      cwd: './backend',
      script: 'dist/main.js',
      env: { NODE_ENV: 'production' },
      autorestart: true,
    },
    {
      name: 'signage-panel',
      cwd: './panel/.next/standalone',
      script: 'server.js',
      env: { NODE_ENV: 'production', PORT: '3000', HOSTNAME: '127.0.0.1' },
      autorestart: true,
    },
  ],
};

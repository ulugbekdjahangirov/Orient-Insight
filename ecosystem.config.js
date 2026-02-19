module.exports = {
  apps: [{
    name: 'orient-insight',
    script: './server/src/index.js',
    cwd: '/var/www/booking-calendar',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      TZ: 'UTC'
    }
  }]
}

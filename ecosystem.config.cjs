module.exports = {
    apps: [
        {
            name: "lovematch-backend",
            script: "server.js",
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: "1G",
            env: {
                NODE_ENV: "production",
            }
        },
        {
            name: "lovematch-pocketbase",
            script: "pocketbase/pocketbase.exe",
            args: "serve --http=0.0.0.0:8090",
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: "500M"
        }
    ]
};

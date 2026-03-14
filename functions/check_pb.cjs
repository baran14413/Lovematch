const PocketBase = require('pocketbase/cjs');
const pb = new PocketBase('http://127.0.0.1:8090');

async function check() {
    try {
        await pb.collection('_superusers').authWithPassword('temp_admin@lovematch.com', 'admin123456');
        const colls = await pb.collections.getFullList();
        console.log("COLLECTIONS:", colls.map(c => c.name));

        const users = await pb.collection('users').getFullList();
        console.log("USERS COUNT:", users.length);
        if (users.length > 0) console.log("SAMPLE USER:", users[0].username);
    } catch (e) { console.error(e); }
}
check();

import PocketBase from 'pocketbase';

async function fixFeed() {
    const pb = new PocketBase('https://lovemtch.shop');

    try {
        console.log("Fixing Feed (Remote)...");

        // 1. Ensure we have some valid users
        const usersRes = await pb.collection('users').getList(1, 50);
        let validUsers = usersRes.items;

        console.log(`Initial valid users count: ${validUsers.length}`);

        if (validUsers.length === 0) {
            console.log("Creating new test users with random names...");
            const names = ['Melis', 'Mert', 'Selin', 'Can', 'Aslı'];
            for (const name of names) {
                try {
                    const username = `${name.toLowerCase()}_${Math.floor(Math.random() * 1000000)}`;
                    const email = `${username}@example.com`;
                    const u = await pb.collection('users').create({
                        username,
                        name,
                        email,
                        password: 'password123',
                        passwordConfirm: 'password123',
                        avatarEmoji: '😊',
                        color: '#8b5cf6'
                    });
                    console.log(`User ${username} created!`);
                    validUsers.push(u);
                } catch (e) {
                    console.error(`User creation failed: ${e.message}`);
                }
            }
        }

        if (validUsers.length === 0) {
            // Last resort: try to find users from posts themselves
            console.log("Still no users. Looking at posts to find author IDs...");
            const postsRaw = await pb.collection('posts').getList(1, 100);
            const authorIds = [...new Set(postsRaw.items.map(p => p.author).filter(Boolean))];
            console.log(`Found ${authorIds.length} candidate author IDs from posts.`);

            for (const id of authorIds) {
                try {
                    const u = await pb.collection('users').getOne(id);
                    validUsers.push(u);
                } catch (e) { }
            }
        }

        if (validUsers.length === 0) {
            console.error("CRITICAL: No users found anywhere!");
            return;
        }

        console.log(`Repairing with ${validUsers.length} users.`);

        const postsRes = await pb.collection('posts').getFullList();

        for (const post of postsRes) {
            const updates = {};
            let needsUpdate = false;

            // Check author expandability
            try {
                const check = await pb.collection('posts').getOne(post.id, { expand: 'author' });
                if (!check.expand?.author) {
                    const randomUser = validUsers[Math.floor(Math.random() * validUsers.length)];
                    updates.author = randomUser.id;
                    needsUpdate = true;
                    console.log(`Fixing author for ${post.id}`);
                }
            } catch (e) {
                const randomUser = validUsers[Math.floor(Math.random() * validUsers.length)];
                updates.author = randomUser.id;
                needsUpdate = true;
                console.log(`Fixing missing author for ${post.id}`);
            }

            if (post.likes === null || post.likes === undefined) {
                updates.likes = [];
                needsUpdate = true;
            }
            if (post.comments === null || post.comments === undefined) {
                updates.comments = [];
                needsUpdate = true;
            }

            if (needsUpdate) {
                await pb.collection('posts').update(post.id, updates);
            }
        }

        console.log("Done! ✨");
    } catch (e) {
        console.error("Repair Error:", e);
    }
}

fixFeed();

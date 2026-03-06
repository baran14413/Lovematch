import { DatabaseSync } from 'node:sqlite';

const dbPath = 'c:/Users/Administrator/Desktop/lovematch-clone/pocketbase/pb_data/data.db';

async function repairDB() {
    try {
        console.log("Deep Repairing SQLite Database...");
        const db = new DatabaseSync(dbPath);

        // 1. Get all current user IDs
        const users = db.prepare("SELECT id FROM users").all();
        const userIds = users.map(u => u.id);

        if (userIds.length === 0) {
            console.error("No users found! Please create users first.");
            return;
        }

        console.log(`Available user IDs: ${userIds.length}`);

        // 2. Fetch all posts
        const posts = db.prepare("SELECT id, author, content FROM posts").all();
        console.log(`Processing ${posts.length} posts...`);

        const updateStmt = db.prepare("UPDATE posts SET author = ?, likes = ?, comments = ? WHERE id = ?");
        const checkUserStmt = db.prepare("SELECT 1 FROM users WHERE id = ?");

        let fixedCount = 0;
        for (const post of posts) {
            let author = post.author;
            // Native sqlite check
            const userExists = db.prepare("SELECT id FROM users WHERE id = ?").get(author);

            if (!userExists) {
                author = userIds[Math.floor(Math.random() * userIds.length)];
                fixedCount++;
                console.log(`Fixed post ${post.id}: ${post.content.substring(0, 20)}... assigned to user ${author}`);
            }

            // Important: PB stores JSON as text. '[]' is correct for empty array.
            updateStmt.run(author, '[]', '[]', post.id);
        }

        console.log(`Repair complete. ${fixedCount} posts fixed.`);

    } catch (e) {
        console.error("Repair Error:", e);
    }
}

repairDB();

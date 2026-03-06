import { DatabaseSync } from 'node:sqlite';

const dbPath = 'c:/Users/Administrator/Desktop/lovematch-clone/pocketbase/pb_data/data.db';

function checkIds() {
    const db = new DatabaseSync(dbPath);

    console.log("Users IDs:");
    const users = db.prepare("SELECT id FROM users LIMIT 5").all();
    console.log(users);

    console.log("Posts Authors:");
    const posts = db.prepare("SELECT id, author FROM posts LIMIT 5").all();
    console.log(posts);
}

checkIds();

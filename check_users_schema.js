import { DatabaseSync } from 'node:sqlite';

const dbPath = 'c:/Users/Administrator/Desktop/lovematch-clone/pocketbase/pb_data/data.db';

function checkSchema() {
    const db = new DatabaseSync(dbPath);
    const result = db.prepare("SELECT name, schema FROM _collections WHERE name = 'users'").get();
    if (result) {
        console.log("Users Collection Schema:", JSON.parse(result.schema));
    } else {
        console.log("Users collection not found");
    }
}

checkSchema();

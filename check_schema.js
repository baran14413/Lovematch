import { DatabaseSync } from 'node:sqlite';

const dbPath = 'c:/Users/Administrator/Desktop/lovematch-clone/pocketbase/pb_data/data.db';

function checkSchema() {
    const db = new DatabaseSync(dbPath);
    const result = db.prepare("SELECT name, schema FROM _collections WHERE name = 'posts'").get();
    console.log("Collection Schema:", JSON.parse(result.schema));
}

checkSchema();

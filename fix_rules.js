import { DatabaseSync } from 'node:sqlite';

const dbPath = 'c:/Users/Administrator/Desktop/lovematch-clone/pocketbase/pb_data/data.db';

function fixAll() {
    const db = new DatabaseSync(dbPath);

    // 1. Check current rules
    const cols = db.prepare("SELECT name, listRule, viewRule, createRule, updateRule, deleteRule FROM _collections WHERE name IN ('posts','users')").all();
    console.log("Current Rules:", JSON.stringify(cols, null, 2));

    // 2. Fix Posts - CRITICAL: updateRule must allow any authenticated user to update likes/comments
    // The old rule 'author = @request.auth.id' blocks liking by non-authors
    db.prepare("UPDATE _collections SET updateRule = '@request.auth.id != \"\"', createRule = '@request.auth.id != \"\"', listRule = '', viewRule = '' WHERE name = 'posts'").run();

    // 3. Fix Users - public list/view, any auth update (needed for follow system)
    db.prepare("UPDATE _collections SET listRule = '', viewRule = '', updateRule = '@request.auth.id != \"\"' WHERE name = 'users'").run();

    // 4. Create friend_requests collection if not exists
    const frExists = db.prepare("SELECT 1 FROM _collections WHERE name = 'friend_requests'").get();
    if (!frExists) {
        console.log("Creating friend_requests collection...");
        const id = 'fr_' + Math.random().toString(36).substring(2, 17);
        const schema = JSON.stringify([
            { system: false, id: 'fr_from', name: 'from_user', type: 'relation', required: true, options: { collectionId: '_pb_users_auth_', cascadeDelete: true, maxSelect: 1 } },
            { system: false, id: 'fr_to', name: 'to_user', type: 'relation', required: true, options: { collectionId: '_pb_users_auth_', cascadeDelete: true, maxSelect: 1 } },
            { system: false, id: 'fr_status', name: 'status', type: 'text', required: false, options: { min: null, max: null, pattern: '' } }
        ]);
        db.prepare("INSERT INTO _collections (id, name, type, system, schema, listRule, viewRule, createRule, updateRule, deleteRule) VALUES (?, 'friend_requests', 'base', 0, ?, '@request.auth.id != \"\"', '@request.auth.id != \"\"', '@request.auth.id != \"\"', '@request.auth.id != \"\"', '@request.auth.id != \"\"')").run(id, schema);
        console.log("friend_requests collection created!");
    }

    // 5. Create notifications collection if not exists
    const notifExists = db.prepare("SELECT 1 FROM _collections WHERE name = 'notifications'").get();
    if (!notifExists) {
        console.log("Creating notifications collection...");
        const id = 'notif_' + Math.random().toString(36).substring(2, 17);
        const schema = JSON.stringify([
            { system: false, id: 'notif_user', name: 'user', type: 'relation', required: true, options: { collectionId: '_pb_users_auth_', cascadeDelete: true, maxSelect: 1 } },
            { system: false, id: 'notif_type', name: 'type', type: 'text', required: false, options: {} },
            { system: false, id: 'notif_title', name: 'title', type: 'text', required: false, options: {} },
            { system: false, id: 'notif_body', name: 'body', type: 'text', required: false, options: {} },
            { system: false, id: 'notif_data', name: 'data', type: 'json', required: false, options: { maxSize: 2000000 } },
            { system: false, id: 'notif_read', name: 'read', type: 'bool', required: false, options: {} },
            { system: false, id: 'notif_from', name: 'from_user', type: 'relation', required: false, options: { collectionId: '_pb_users_auth_', cascadeDelete: false, maxSelect: 1 } }
        ]);
        db.prepare("INSERT INTO _collections (id, name, type, system, schema, listRule, viewRule, createRule, updateRule, deleteRule) VALUES (?, 'notifications', 'base', 0, ?, '@request.auth.id != \"\"', '@request.auth.id != \"\"', '@request.auth.id != \"\"', '@request.auth.id != \"\"', '@request.auth.id != \"\"')").run(id, schema);
        console.log("notifications collection created!");
    }

    console.log("\n✅ All rules fixed & collections ready!");

    // Verify
    const after = db.prepare("SELECT name, updateRule FROM _collections WHERE name IN ('posts','users','friend_requests','notifications')").all();
    console.log("After Fix:", JSON.stringify(after, null, 2));
}

fixAll();

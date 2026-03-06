import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

async function migrateFollowers() {
    try {
        await pb.admins.authWithPassword('admin@lovematch.com', 'lovematchadmin123');
        console.log("Admin authenticated.");

        const usersCollection = await pb.collections.getOne('users');

        // Find following and followers and update their types
        usersCollection.schema = usersCollection.schema.map(field => {
            if (field.name === 'following' || field.name === 'followers') {
                return {
                    ...field,
                    type: 'relation',
                    options: {
                        collectionId: '_pb_users_auth_',
                        cascadeDelete: false,
                        maxSelect: null,
                        displayFields: null
                    }
                };
            }
            return field;
        });

        await pb.collections.update('users', usersCollection);
        console.log("Followers/Following fields migrated to Relation type successfully.");
    } catch (e) {
        console.error("Migration failed:", e.response?.data || e);
    }
}

migrateFollowers();

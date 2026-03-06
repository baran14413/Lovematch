import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

async function init() {
    try {
        await pb.admins.authWithPassword('admin@lovematch.com', 'lovematchadmin123');
        console.log("Admin authenticated.");
    } catch (e) {
        console.error("Admin authentication failed.");
        return;
    }

    try {
        const usersCollection = await pb.collections.getOne('users');

        let existingFields = usersCollection.schema.map(f => f.name);
        let newFields = [
            { name: 'coins', type: 'number' },
            { name: 'level', type: 'number' },
            { name: 'avatarEmoji', type: 'text' },
            { name: 'color', type: 'text' },
            { name: 'friends', type: 'json', options: { maxSize: 2000000 } },
            { name: 'bio', type: 'text' },
            { name: 'tags', type: 'json', options: { maxSize: 2000000 } },
            { name: 'stats', type: 'json', options: { maxSize: 2000000 } },
            { name: 'avatar', type: 'file', options: { maxSelect: 1, maxSize: 5242880, mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'] } },
            { name: 'following', type: 'relation', options: { collectionId: '_pb_users_auth_', cascadeDelete: false, maxSelect: null } },
            { name: 'followers', type: 'relation', options: { collectionId: '_pb_users_auth_', cascadeDelete: false, maxSelect: null } },
            { name: 'isVIP', type: 'bool' },
            { name: 'vipUntil', type: 'date' },
            { name: 'bubbleStyle', type: 'text' },
            { name: 'premiumBadge', type: 'bool' }
        ];

        let schemaModified = false;
        newFields.forEach(nf => {
            if (!existingFields.includes(nf.name)) {
                usersCollection.schema.push(nf);
                schemaModified = true;
            }
        });

        if (schemaModified) {
            await pb.collections.update('users', usersCollection);
            console.log("Users collection updated successfully.");
        } else {
            console.log("Users collection already has the custom fields.");
        }
    } catch (e) {
        console.error("Error updating users:", e.response?.data?.schema || e);
    }

    // Create Posts if it doesn't exist
    try {
        await pb.collections.create({
            name: 'posts',
            type: 'base',
            listRule: '',
            viewRule: '',
            createRule: '@request.auth.id != ""',
            updateRule: '@request.auth.id = author',
            deleteRule: '@request.auth.id = author',
            schema: [
                {
                    name: 'author',
                    type: 'relation',
                    options: {
                        collectionId: '_pb_users_auth_',
                        cascadeDelete: true,
                        maxSelect: 1
                    }
                },
                { name: 'content', type: 'text' },
                { name: 'likes', type: 'json', options: { maxSize: 2000000 } },
                { name: 'comments', type: 'json', options: { maxSize: 2000000 } },
                { name: 'image', type: 'file', options: { maxSelect: 1, maxSize: 5242880, mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'] } }
            ]
        });
        console.log("Posts collection created.");
    } catch (e) {
        console.log("Posts collection error (might already exist)");
    }

    // Create direct_messages if it doesn't exist
    try {
        await pb.collections.create({
            name: 'direct_messages',
            type: 'base',
            listRule: '@request.auth.id = sender || @request.auth.id = receiver',
            viewRule: '@request.auth.id = sender || @request.auth.id = receiver',
            createRule: '@request.auth.id != ""',
            updateRule: '@request.auth.id = receiver', // Only receiver can mark as read
            deleteRule: '@request.auth.id = sender',
            schema: [
                {
                    name: 'sender',
                    type: 'relation',
                    options: { collectionId: '_pb_users_auth_', cascadeDelete: true, maxSelect: 1 }
                },
                {
                    name: 'receiver',
                    type: 'relation',
                    options: { collectionId: '_pb_users_auth_', cascadeDelete: true, maxSelect: 1 }
                },
                { name: 'text', type: 'text', options: { minLength: 1, maxLength: 2000 } },
                { name: 'read', type: 'bool' }
            ]
        });
        console.log("Direct Messages collection created.");
    } catch (e) {
        console.log("Direct Messages collection error (might already exist)");
    }
}

init();

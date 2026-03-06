import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

async function testFollow() {
    try {
        await pb.admins.authWithPassword('admin@lovematch.com', 'lovematchadmin123');
        console.log("Admin OK");

        const userA = 'fnapsa2jvvqwl76'; // Emirhan
        const userB = '5x9xj5xa1nenqhk'; // users52756

        // Reset
        await pb.collection('users').update(userA, { following: [] });
        await pb.collection('users').update(userB, { followers: [] });
        console.log("Reset OK");

        // Simulate Follow
        const freshA = await pb.collection('users').getOne(userA);
        const freshB = await pb.collection('users').getOne(userB);

        const fing = Array.isArray(freshA.following) ? [...freshA.following] : [];
        if (!fing.includes(userB)) fing.push(userB);

        await pb.collection('users').update(userA, { following: fing });
        console.log("UserA updated");

        const fers = Array.isArray(freshB.followers) ? [...freshB.followers] : [];
        if (!fers.includes(userA)) fers.push(userA);

        await pb.collection('users').update(userB, { followers: fers });
        console.log("UserB updated");

        // Check again
        const checkA = await pb.collection('users').getOne(userA);
        const checkB = await pb.collection('users').getOne(userB);
        console.log("RESULT A FOLLOWING:", checkA.following);
        console.log("RESULT B FOLLOWERS:", checkB.followers);

    } catch (e) {
        console.error("TEST FAILED:", e);
    }
}

testFollow();

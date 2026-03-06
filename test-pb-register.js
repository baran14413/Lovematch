import PocketBase from 'pocketbase';

const pb = new PocketBase('http://localhost:8090');

async function testRegister() {
    try {
        const record = await pb.collection('users').create({
            email: 'test' + Math.random() + '@test.com',
            password: 'password123',
            passwordConfirm: 'password123',
            username: 'testuser' + Math.floor(Math.random() * 1000),
            name: 'testuser',
            bio: 'Hello world',
            hobbies: 'coding,music',
            coins: 1000,
            level: 1,
            avatarEmoji: '🌸',
            color: '#fca5a5'
        });
        console.log('Success:', record);
    } catch (err) {
        console.error('Failure:', err.message);
        console.error('Validation errors:', JSON.stringify(err.response, null, 2));
    }
}

testRegister();

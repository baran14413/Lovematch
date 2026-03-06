import PocketBase from 'pocketbase';

const pbUrl = 'https://lovemtch.shop';

async function seedV2() {
    const pb = new PocketBase(pbUrl);

    try {
        console.log("Seeding Premium V2 Feed...");

        // 1. Get current users
        const users = await pb.collection('users').getList(1, 20);
        if (users.items.length < 3) {
            console.error("Not enough users to seed posts!");
            return;
        }

        const validUsers = users.items;

        const premiumPosts = [
            { content: "Yeni profil rozetim (💎) nasıl görünüyor? Bence çok havalı! ✨", author: validUsers[0].id },
            { content: "Bu akşam parti odasında müzik yayını yapıyorum, hepinizi beklerim! 🎧🎤", author: validUsers[1].id },
            { content: "1v1 eşleşmede harika biriyle tanıştım. Teşekkürler LoveMatch! ❤️", author: validUsers[2].id },
            { content: "Günün sözü: Başkaları için değil, kendin için parla. 🌟", author: validUsers[0].id },
            { content: "Hangi maskot daha tatlı sizce? Karar veremedim... 🤔🐾", author: validUsers[1].id }
        ];

        for (const p of premiumPosts) {
            try {
                // We create them without auth if rules allow, or we skip since we fixed rules
                await pb.collection('posts').create({
                    ...p,
                    likes: [],
                    comments: []
                });
                console.log(`Created: ${p.content.substring(0, 20)}...`);
            } catch (e) {
                console.error(`Post creation failed: ${e.message}`);
            }
        }

        console.log("Seeding V2 Complete! 🚀");
    } catch (e) {
        console.error("Seed V2 Error:", e);
    }
}

seedV2();

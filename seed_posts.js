
const pbUrl = 'http://127.0.0.1:8090/api';

async function seed() {
    try {
        console.log("Fetching users...");
        let records;
        try {
            const res = await fetch(`${pbUrl}/collections/users/records?perPage=50`);
            const data = await res.json();
            records = data.items;
        } catch (e) {
            console.error("Pocketbase is not running?", e);
            return;
        }

        if (!records || records.length === 0) {
            console.log("No users found. Creating some test female users...");
            const dummyUsers = [
                { username: "aylin99", name: "Aylin", gender: "female", bio: "Müzik ve kahve aşığı 💖" },
                { username: "zeynep_x", name: "Zeynep", gender: "female", bio: "Gezgin ruhlu ✈️🌍" },
                { username: "cansu_kaya", name: "Cansu", gender: "female", bio: "Sinema bağımlısı 🍿" },
                { username: "merve.y", name: "Merve", gender: "female", bio: "Doğa ile iç içe 🌿" },
                { username: "elif__1", name: "Elif", gender: "female", bio: "Kahve delisi ☕" }
            ];

            records = [];
            for (const u of dummyUsers) {
                const colors = ['#ec4899', '#f43f5e', '#d946ef', '#a855f7'];
                const emojis = ['👩', '👱‍♀️', '👧', '💃', '🧚‍♀️', '👸', '😻'];

                const response = await fetch(`${pbUrl}/collections/users/records`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: u.username + Math.floor(Math.random() * 99999),
                        name: u.name,
                        email: `${u.username}${Math.floor(Math.random() * 99999)}@example.com`,
                        password: "password123",
                        passwordConfirm: "password123",
                        bio: u.bio,
                        avatarEmoji: emojis[Math.floor(Math.random() * emojis.length)],
                        color: colors[Math.floor(Math.random() * colors.length)],
                        emailVisibility: false
                    })
                });
                const newUser = await response.json();
                if (newUser.id && !newUser.code) {
                    records.push(newUser);
                } else {
                    console.error("Failed to create user:", newUser);
                }
            }
            console.log(`Dummy users created! Found ${records.length} users.`);
        }

        console.log(`Found ${records.length} users. Creating posts...`);

        const messages = [
            "Bugün harika bir gün! 🥰",
            "Kahvemi aldım, müziğimi açtım. Varsa güzel bir şarkı öneriniz alırım! ☕🎶",
            "Yeni insanlarla tanışmayı çok seviyorum. Kimler burada?",
            "Dün izlediğim film o kadar iyiydi ki... Aklından çıkaramıyorum 🎬",
            "Spor sonrası gelen o mükemmel rahatlık hissi \>\>\>",
            "Bazen sadece uzaklara gitmek istersin... ✈️",
            "Bugün kendimi çok enerjik hissediyorum! Parti odası açan var mı? 🎉",
            "Sizce de yağmurlu havalar çok romantik değil mi? 🌧️🫶",
            "Sonunda beklediğim hafta sonu geldi! Herkese iyi tatiller 🌸",
            "Güne gülümseyerek başlamak gibisi yok ✨",
            "Hayat bazen çok yorucu ama sevdiklerin yanındayken her şey çok daha kolay. ❤️",
            "Biraz motivasyon: Başlamak için mükemmel olmak zorunda değilsin, ama mükemmel olmak için başlamak zorundasın! 💪",
            "Bugün canım çok sıkkın, sohbet etmek isteyen var mı?",
            "1v1 Eşleşme'de şansımı deneyeceğim, belki ruh eşimle karşılaşırım! 🤞"
        ];

        for (let i = 0; i < 15; i++) {
            const randomUser = records[Math.floor(Math.random() * records.length)];
            const randomMsg = messages[Math.floor(Math.random() * messages.length)];

            // Auth as user first
            const authRes = await fetch(`${pbUrl}/collections/users/auth-with-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    identity: randomUser.username,
                    password: 'password123'
                })
            });
            const authData = await authRes.json();
            const token = authData.token;
            if (!token) console.error("No token!", authData);

            const postRes = await fetch(`${pbUrl}/collections/posts/records`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    author: randomUser.id,
                    content: randomMsg
                })
            });

            const postData = await postRes.json();
            if (postData.id) {
                console.log(`Created post for ${randomUser.username}: ${randomMsg.substring(0, 20)}...`);
            } else {
                console.error('Failed to create post:', postData);
            }
        }

        console.log("Seeding complete! 🚀");
    } catch (e) {
        console.error("Error seeding posts:", e);
    }
}

seed();

import { pb } from '../pb';
import { tGlobal } from './languages';

export const SocialService = {
    // ══════════ ARKADAŞLIK İSTEĞİ ══════════

    async sendFriendRequest(toUserId: string) {
        const user = pb.authStore.model;
        if (!user) throw new Error(tGlobal('login_required'));
        if (user.id === toUserId) throw new Error(tGlobal('cannot_send_request_to_self'));

        // Check if already sent
        try {
            const existing = await pb.collection('friend_requests').getFirstListItem(
                `from_user = "${user.id}" && to_user = "${toUserId}" && status != "rejected"`
            );
            if (existing) throw new Error(tGlobal('friend_request_already_sent'));
        } catch (e: any) {
            if (e.status !== 404 && e.message !== tGlobal('friend_request_already_sent')) {
                // 404 means no existing request - that's fine
            }
            if (e.message === tGlobal('friend_request_already_sent')) throw e;
        }

        // Create friend request
        const request = await pb.collection('friend_requests').create({
            from_user: user.id,
            to_user: toUserId,
            status: 'pending'
        });

        // Send notification via socket
        const socket = (window as any).socket;
        if (socket) {
            socket.emit('send_notification', {
                toUserId,
                type: 'friend_request',
                title: tGlobal('new_friend_request_title'),
                body: tGlobal('new_friend_request_body').replace('${from}', user.username || user.name || 'Birisi'),
                data: { requestId: request.id, fromUserId: user.id }
            });
        }

        // Also create in notifications collection
        try {
            await pb.collection('notifications').create({
                user: toUserId,
                type: 'friend_request',
                title: tGlobal('new_friend_request_title'),
                body: tGlobal('new_friend_request_body').replace('${from}', user.username || 'Birisi'),
                data: JSON.stringify({ requestId: request.id }),
                read: false,
                from_user: user.id
            });
        } catch (e) {
            console.warn('Notification record failed:', e);
        }

        return request;
    },

    async acceptFriendRequest(requestId: string) {
        const user = pb.authStore.model;
        if (!user) throw new Error('Giriş yapmanız gerekiyor');

        const request = await pb.collection('friend_requests').update(requestId, {
            status: 'accepted'
        });

        // Notify the sender
        const socket = (window as any).socket;
        if (socket) {
            socket.emit('send_notification', {
                toUserId: request.from_user,
                type: 'friend_accepted',
                title: tGlobal('friend_accepted_title'),
                body: tGlobal('friend_accepted_body').replace('${from}', user.username || 'Birisi'),
                data: { requestId }
            });
        }

        try {
            await pb.collection('notifications').create({
                user: request.from_user,
                type: 'friend_accepted',
                title: tGlobal('friend_accepted_title'),
                body: tGlobal('friend_accepted_body').replace('${from}', user.username || 'Birisi'),
                read: false,
                from_user: user.id
            });
        } catch (e) { console.warn(e); }

        return request;
    },

    async rejectFriendRequest(requestId: string) {
        return await pb.collection('friend_requests').update(requestId, {
            status: 'rejected'
        });
    },

    async getPendingRequests() {
        const user = pb.authStore.model;
        if (!user) return [];
        try {
            const res = await pb.collection('friend_requests').getList(1, 50, {
                filter: `to_user = "${user.id}" && status = "pending"`,
                expand: 'from_user',
                sort: '-created'
            });
            return res.items;
        } catch (e) { return []; }
    },

    async getSentRequests() {
        const user = pb.authStore.model;
        if (!user) return [];
        try {
            const res = await pb.collection('friend_requests').getList(1, 50, {
                filter: `from_user = "${user.id}" && status = "pending"`,
                expand: 'to_user',
                sort: '-created'
            });
            return res.items;
        } catch (e) { return []; }
    },

    async getFriends() {
        const user = pb.authStore.model;
        if (!user) return [];
        try {
            const res = await pb.collection('friend_requests').getFullList({
                filter: `(from_user = "${user.id}" || to_user = "${user.id}") && status = "accepted"`,
                expand: 'from_user,to_user'
            });
            return res.map(r => {
                const friend = r.from_user === user.id ? r.expand?.to_user : r.expand?.from_user;
                return { ...friend, requestId: r.id };
            }).filter(Boolean);
        } catch (e) { return []; }
    },

    // ══════════ TAKİP SİSTEMİ ══════════

    async followUser(targetUserId: string) {
        console.log('[SocialService] Follow request for target:', targetUserId);
        const user = pb.authStore.model;
        if (!user) throw new Error('Giriş yapmanız gerekiyor');

        const myId = user.id;
        if (!targetUserId || targetUserId === 'undefined' || targetUserId === 'null' || !targetUserId.trim()) {
            throw new Error('Geçersiz hedef kullanıcı ID: ' + targetUserId);
        }
        if (myId === targetUserId) return;

        try {
            // 1. Oku (Fresh read is needed because we map authStore model which might be stale)
            const freshMe = await pb.collection('users').getOne(myId);
            const freshTarget = await pb.collection('users').getOne(targetUserId);

            const myFollowing = Array.isArray(freshMe.following) ? [...freshMe.following] : [];
            const targetFollowers = Array.isArray(freshTarget.followers) ? [...freshTarget.followers] : [];

            if (!myFollowing.includes(targetUserId)) {
                myFollowing.push(targetUserId);
                await pb.collection('users').update(myId, { following: myFollowing });
                // Re-fetch me to be 100% sure about the state
                const finalMe = await pb.collection('users').getOne(myId);
                pb.authStore.save(pb.authStore.token, finalMe);
            }

            if (!targetFollowers.includes(myId)) {
                targetFollowers.push(myId);
                await pb.collection('users').update(targetUserId, { followers: targetFollowers });
            }

            console.log('[SocialService] Follow SUCCESS:', myId, '->', targetUserId);
        } catch (e: any) {
            console.error('[SocialService] Follow FAILED:', e);
            throw new Error(e.message || 'Takip işlemi başarısız oldu');
        }

        // Socket notify
        const socket = (window as any).socket;
        if (socket) {
            socket.emit('send_notification', {
                toUserId: targetUserId,
                type: 'follow',
                title: tGlobal('new_follower_title'),
                body: tGlobal('new_follower_body').replace('${from}', user.username || user.name || 'Birisi'),
                data: { followerId: user.id }
            });
        }

        try {
            await pb.collection('notifications').create({
                user: targetUserId,
                type: 'follow',
                title: tGlobal('new_follower_title'),
                body: tGlobal('new_follower_body').replace('${from}', user.username || user.name || 'Birisi'),
                read: false,
                from_user: user.id,
                data: JSON.stringify({ followerId: user.id })
            });
        } catch (e) { console.warn('[SocialService] Notification create warning:', e); }
    },

    async unfollowUser(targetUserId: string) {
        const user = pb.authStore.model;
        if (!user) return;

        const myId = user.id;
        if (!targetUserId || targetUserId === 'undefined' || targetUserId === 'null') return;

        try {
            const freshMe = await pb.collection('users').getOne(myId);
            const freshTarget = await pb.collection('users').getOne(targetUserId);

            const myFollowing = Array.isArray(freshMe.following) ? freshMe.following.filter((id: string) => id !== targetUserId) : [];
            const targetFollowers = Array.isArray(freshTarget.followers) ? freshTarget.followers.filter((id: string) => id !== myId) : [];

            await pb.collection('users').update(myId, { following: myFollowing });
            await pb.collection('users').update(targetUserId, { followers: targetFollowers });

            // Sync authStore
            const finalMe = await pb.collection('users').getOne(myId);
            pb.authStore.save(pb.authStore.token, finalMe);

            console.log('[SocialService] Unfollow SUCCESS:', myId, '->', targetUserId);
        } catch (e) {
            console.error('[SocialService] Unfollow failed:', e);
        }
    },

    isFollowing(targetUserId: string): boolean {
        const user = pb.authStore.model;
        if (!user || !targetUserId) return false;
        const following = user.following;
        if (Array.isArray(following)) return following.includes(targetUserId);
        if (typeof following === 'string' && following.trim()) return following.split(',').filter(Boolean).includes(targetUserId);
        return false;
    },

    async blockUser(targetUserId: string) {
        const user = pb.authStore.model;
        if (!user) throw new Error('Giriş yapmanız gerekiyor');

        const updatedUser = await pb.collection('users').update(user.id, {
            'blocked_users+': targetUserId
        });
        pb.authStore.save(pb.authStore.token, updatedUser);

        // Auto unfollow
        await this.unfollowUser(targetUserId);
    },

    async removeFollower(followerId: string) {
        const user = pb.authStore.model;
        if (!user) return;

        // Remove from my followers
        const updatedUser = await pb.collection('users').update(user.id, {
            'followers-': followerId
        });
        pb.authStore.save(pb.authStore.token, updatedUser);

        // Remove from target's following
        try {
            await pb.collection('users').update(followerId, {
                'following-': user.id
            });
        } catch (e) { console.warn(e); }
    },

    // ══════════ BİLDİRİMLER ══════════

    async getNotifications() {
        const user = pb.authStore.model;
        if (!user) return [];
        try {
            const res = await pb.collection('notifications').getList(1, 50, {
                filter: `user = "${user.id}"`,
                expand: 'from_user',
                sort: '-created'
            });
            return res.items;
        } catch (e) { return []; }
    },

    async markNotificationRead(notifId: string) {
        try {
            await pb.collection('notifications').update(notifId, { read: true });
        } catch (e) { console.warn(e); }
    },

    async getUnreadCount() {
        const user = pb.authStore.model;
        if (!user) return 0;
        try {
            const res = await pb.collection('notifications').getList(1, 1, {
                filter: `user = "${user.id}" && read = false`
            });
            return res.totalItems;
        } catch (e) { return 0; }
    },

    // ══════════ LIKE/COMMENT İLE BİLDİRİM ══════════

    async notifyPostLike(post: any, likerUsername: string) {
        if (!post?.author || post.author === pb.authStore.model?.id) return;

        const socket = (window as any).socket;
        if (socket) {
            socket.emit('send_notification', {
                toUserId: post.author,
                type: 'like',
                title: tGlobal('liked_post').replace('${from}', likerUsername),
                body: post.content?.substring(0, 40) || 'Paylaşımın',
                data: { postId: post.id }
            });
        }

        try {
            await pb.collection('notifications').create({
                user: post.author,
                type: 'like',
                title: tGlobal('liked_post').replace('${from}', likerUsername),
                body: (post.content || '').substring(0, 60),
                read: false,
                from_user: pb.authStore.model?.id,
                data: JSON.stringify({ postId: post.id })
            });
        } catch (e) { console.warn(e); }
    },

    async notifyPostComment(post: any, commenterUsername: string, commentText: string) {
        if (!post?.author || post.author === pb.authStore.model?.id) return;

        const socket = (window as any).socket;
        if (socket) {
            socket.emit('send_notification', {
                toUserId: post.author,
                type: 'comment',
                title: tGlobal('commented_on_post').replace('${from}', commenterUsername),
                body: commentText.substring(0, 50),
                data: { postId: post.id }
            });
        }

        try {
            await pb.collection('notifications').create({
                user: post.author,
                type: 'comment',
                title: tGlobal('commented_on_post').replace('${from}', commenterUsername),
                body: commentText.substring(0, 60),
                read: false,
                from_user: pb.authStore.model?.id,
                data: JSON.stringify({ postId: post.id })
            });
        } catch (e) { console.warn(e); }
    }
};

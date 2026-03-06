import { LocalNotifications } from '@capacitor/local-notifications';
import { tGlobal } from './languages';

export const NotificationService = {
    _initialized: false,

    async init() {
        if (this._initialized) return;
        try {
            const perm = await LocalNotifications.checkPermissions();
            if (perm.display !== 'granted') {
                await LocalNotifications.requestPermissions();
            }

            // Channels for different notification types
            const channels: any[] = [
                { id: 'default', name: tGlobal('notifications'), description: '', importance: 4, vibration: true, visibility: 1 },
                { id: 'messages', name: tGlobal('chat'), description: '', importance: 5, vibration: true, visibility: 1 },
                { id: 'social', name: 'Social', description: '', importance: 4, vibration: true, visibility: 1 },
                { id: 'party', name: tGlobal('party'), description: '', importance: 3, vibration: true, visibility: 1 },
                { id: 'likes', name: 'Engagement', description: '', importance: 2, vibration: false, visibility: 1 },
            ];

            for (const ch of channels) {
                await LocalNotifications.createChannel(ch);
            }

            // Listen for notification actions
            await LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
                const data = notification.notification.extra;
                const actionId = notification.actionId;

                if (actionId === 'finish') {
                    window.dispatchEvent(new CustomEvent('force-leave-room', { detail: data }));
                    this.clearOngoingRoom();
                    return;
                }

                if (data?.type === 'friend_request') {
                    window.dispatchEvent(new CustomEvent('navigate', { detail: '/profile' }));
                } else if (data?.type === 'message') {
                    window.dispatchEvent(new CustomEvent('navigate', { detail: '/chat' }));
                } else if (data?.type === 'party_invite') {
                    window.dispatchEvent(new CustomEvent('navigate', { detail: '/party' }));
                }
            });

            this._initialized = true;
        } catch (e) {
            console.warn('Notification init (web mode):', e);
        }
    },

    async show(title: string, body: string, data?: any) {
        try {
            const channelId = data?.channel || 'default';

            // Native System Bildirimi
            await LocalNotifications.schedule({
                notifications: [
                    {
                        title,
                        body,
                        id: Math.floor(Math.random() * 100000),
                        schedule: { at: new Date(Date.now() + 100) }, // Hemen
                        sound: 'default',
                        attachments: undefined,
                        actionTypeId: '',
                        extra: data,
                        channelId,
                        smallIcon: 'ic_stat_icon_config_sample' // Eğer varsa
                    }
                ]
            });

            // Eğer uygulama açıksa, UI toast da gösterilebilir (isteğe bağlı)
            window.dispatchEvent(new CustomEvent('in-app-notification', {
                detail: { title, body, data }
            }));
        } catch (e) {
            console.warn('LocalNotifications schedule hatası:', e);
            // Fallback: sadece in-app
            window.dispatchEvent(new CustomEvent('in-app-notification', {
                detail: { title, body, data }
            }));
        }
    },

    _getChannel(type?: string): string {
        switch (type) {
            case 'message': return 'messages';
            case 'friend_request': case 'follow': case 'friend_accepted': return 'social';
            case 'party_invite': return 'party';
            case 'like': case 'comment': return 'likes';
            default: return 'default';
        }
    },

    // Quick helpers
    async notifyMessage(from: string, text: string) {
        await this.show(
            `💬 ${from}`,
            text.length > 60 ? text.slice(0, 60) + '...' : text,
            { type: 'message', from, channel: 'messages' }
        );
    },

    async notifyFriendRequest(from: string) {
        await this.show(
            tGlobal('new_friend_request_title'),
            tGlobal('new_friend_request_body').replace('${from}', from),
            { type: 'friend_request', from, channel: 'social' }
        );
    },

    async notifyFollow(from: string) {
        await this.show(
            tGlobal('new_follower_title'),
            tGlobal('new_follower_body').replace('${from}', from),
            { type: 'follow', from, channel: 'social' }
        );
    },

    async notifyFriendAccepted(from: string) {
        await this.show(
            tGlobal('friend_accepted_title'),
            tGlobal('friend_accepted_body').replace('${from}', from),
            { type: 'friend_accepted', from, channel: 'social' }
        );
    },

    async notifyLike(from: string, postPreview: string) {
        await this.show(
            tGlobal('liked_post').replace('${from}', from),
            postPreview.length > 40 ? postPreview.slice(0, 40) + '...' : postPreview,
            { type: 'like', from, channel: 'likes' }
        );
    },

    async notifyComment(from: string, comment: string) {
        await this.show(
            tGlobal('commented_on_post').replace('${from}', from),
            comment.length > 50 ? comment.slice(0, 50) + '...' : comment,
            { type: 'comment', from, channel: 'likes' }
        );
    },

    async notifyPartyInvite(from: string, roomName: string) {
        await this.show(
            tGlobal('party_invite_title'),
            tGlobal('party_invite_body').replace('${from}', from).replace('${roomName}', roomName),
            { type: 'party_invite', from, roomName, channel: 'party' }
        );
    },

    async showOngoingRoom(roomName: string) {
        try {
            await LocalNotifications.schedule({
                notifications: [
                    {
                        title: tGlobal('ongoing_room_title').replace('${roomName}', roomName),
                        body: tGlobal('ongoing_room_body'),
                        id: 999,
                        ongoing: true,
                        autoCancel: false,
                        smallIcon: 'res://logo',
                        channelId: 'party',
                        extra: { type: 'room_ongoing', roomName },
                        actionTypeId: 'f_finish' // Define action group
                    }
                ]
            });

            // Register action group (Safe check for different plugin versions)
            const plugin = LocalNotifications as any;
            if (plugin.registerActionTypes) {
                await plugin.registerActionTypes({
                    types: [{
                        id: 'f_finish',
                        actions: [{ id: 'finish', title: tGlobal('finish_room'), foreground: true }]
                    }]
                });
            }
        } catch (e) { }
    },

    async clearOngoingRoom() {
        try {
            await LocalNotifications.cancel({ notifications: [{ id: 999 }] });
        } catch (e) { }
    }
};

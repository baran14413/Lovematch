/**
 * =========================================================================
 *  LOVEMATCH CLONE - FIREBASE CLOUD FUNCTIONS (NATIVE VERSION)
 *  Socket.IO yerine Firestore Snapshots kullanıyoruz (Serverless uyumluluk).
 * =========================================================================
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

// Initialize Firebase Admin (Only once!)
if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();

// OneSignal Configuration
const ONESIGNAL_APP_ID = "dac0906c-e76a-46d4-bf59-4702ddc2cf70";
const ONESIGNAL_REST_API_KEY = "os_v2_app_3laja3hhnjdnjp2zi4bn3qwpocfn5sibyqje2v4lpp5m7ngh3owopcmcmqmpjcc4uc5vfatd5n5ypp2kvbepgnq75z3sihqivdsslfy";

/**
 * Send OneSignal Push Notification
 * This is now a secure HTTPS function or internal helper.
 */
async function sendOneSignalPush(targetUserId, title, body, data = {}) {
    if (!ONESIGNAL_REST_API_KEY) return;
    try {
        await fetch("https://onesignal.com/api/v1/notifications", {
            method: "POST",
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`
            },
            body: JSON.stringify({
                app_id: ONESIGNAL_APP_ID,
                include_external_user_ids: [targetUserId],
                headings: { "en": title, "tr": title },
                contents: { "en": body, "tr": body },
                data: data
            })
        });
    } catch (e) {
        console.error('[OneSignal] Push failed:', e.message);
    }
}

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

/**
 * API Endpoint: Notify User (for Likes, DMs etc)
 */
app.post('/notify', async (req, res) => {
    const { targetUid, title, body, data } = req.body;
    if (!targetUid || !title || !body) return res.status(400).send('Missing args');

    await sendOneSignalPush(targetUid, title, body, data);
    res.send({ status: 'ok' });
});

/**
 * Trigger: New Message Pusher
 * This automatically sends pushes when someone gets a DM without needing a socket server.
 */
exports.onNewMessage = functions.firestore
    .document('direct_messages/{msgId}')
    .onCreate(async (snap, context) => {
        const msg = snap.data();
        const receiverId = msg.receiver;

        // Don't push if no receiver or system message
        if (!receiverId) return;

        await sendOneSignalPush(
            receiverId,
            "Yeni Mesaj! 💬",
            `${msg.name || 'Biri'} sana mesaj gönderdi.`,
            { type: 'dm', senderId: msg.sender }
        );
    });

// Main API Export
exports.api = functions.https.onRequest(app);

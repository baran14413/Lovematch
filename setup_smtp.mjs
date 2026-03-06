import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

async function setup() {
    try {
        await pb.admins.authWithPassword('admin@lovematch.com', 'lovematchadmin123');
        console.log("Admin authenticated.");
    } catch (e) {
        console.error("Admin authentication failed. Start PocketBase first and make sure that admin@lovematch.com / lovematchadmin123 is valid!", e.message);
        return;
    }

    try {
        console.log("Generating free test SMTP account using Ethereal Email...");
        const res = await fetch('https://api.nodemailer.com/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestor: 'LovematchClone', version: '1.0.0' })
        });

        if (!res.ok) {
            throw new Error(`Ethereal API error: ${res.statusText}`);
        }

        const account = await res.json();
        console.log("Ethereal account created:", account.user);

        // Fetch current settings
        const settings = await pb.settings.getAll();

        // Patch tokens to be 40 chars long to pass validation
        const generateToken = () => [...Array(40)].map(() => Math.random().toString(36)[2] || 'a').join('');
        ['adminAuthToken', 'adminPasswordResetToken', 'adminFileToken', 'recordAuthToken', 'recordPasswordResetToken', 'recordEmailChangeToken', 'recordVerificationToken', 'recordFileToken'].forEach(k => {
            if (settings[k] && (!settings[k].secret || settings[k].secret.length < 30)) {
                settings[k].secret = generateToken();
            }
        });

        // Update SMTP settings
        settings.meta.senderName = "Lovematch Team";
        settings.meta.senderAddress = account.user;

        settings.smtp.enabled = true;
        settings.smtp.host = "smtp.ethereal.email";
        settings.smtp.port = 587;
        settings.smtp.username = account.user;
        settings.smtp.password = account.pass;
        settings.smtp.authMethod = "LOGIN";
        settings.smtp.tls = false; // ethereal doesn't strict require tls usually, but starttls works

        await pb.settings.update(settings);
        console.log("---------------------------------------------------------");
        console.log("✅ PocketBase SMTP has been updated successfully!");
        console.log("📧 Test Emails will now be sent using Ethereal Email.");
        console.log("---------------------------------------------------------");
        console.log("⚠️ TO VIEW SENT EMAILS (like password reset links):");
        console.log(`1. Go to: https://ethereal.email/login`);
        console.log(`2. Email: ${account.user}`);
        console.log(`3. Password: ${account.pass}`);
        console.log("---------------------------------------------------------");

    } catch (e) {
        console.error("Error updating settings:", e.message || e);
    }
}

setup();

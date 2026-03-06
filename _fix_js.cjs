const fs = require('fs');
let html = fs.readFileSync('admin-dashboard.html', 'utf8');

const startStr = '// ==================== AI KOMUT SİSTEMİ ====================';
const endStr = '// ==================== INITIAL LOGS ====================';

const start = html.indexOf(startStr);
const end = html.indexOf(endStr);

if (start > -1 && end > -1) {
    const code = `        // ==================== SITE SİSTEMİ ====================
        function previewColor(id, val) {
            document.getElementById('ct-'+id).value = val;
            if(id === 'primary') document.documentElement.style.setProperty('--preview-primary', val);
            if(id === 'secondary') document.documentElement.style.setProperty('--preview-secondary', val);
        }

        function syncColorPicker(id, val) {
            document.getElementById('cp-'+id).value = val;
            previewColor(id, val);
            saveColor(id + 'Color', val);
        }

        async function saveColor(key, val) {
            let o = {};
            o[key] = val;
            try {
                await fetch('/admin/site-settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(o)
                });
            } catch (e) {}
        }

        async function saveSetting(key, val) {
            let o = {};
            o[key] = val;
            try {
                await fetch('/admin/site-settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(o)
                });
                showToast('✅', 'Ayar kaydedildi');
            } catch(e) {}
        }

        async function saveFont(val) {
            try {
                await fetch('/admin/site-settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fontFamily: val })
                });
                showToast('✅', 'Font değiştirildi');
            } catch(e) {}
        }

        async function applyTheme(p, s, b, a) {
            document.getElementById('cp-primary').value = p; document.getElementById('ct-primary').value = p;
            document.getElementById('cp-secondary').value = s; document.getElementById('ct-secondary').value = s;
            document.getElementById('cp-bg').value = b; document.getElementById('ct-bg').value = b;
            document.getElementById('cp-accent').value = a; document.getElementById('ct-accent').value = a;
            previewColor('primary', p);
            previewColor('secondary', s);
            
            await fetch('/admin/site-settings', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ primaryColor: p, secondaryColor: s, bgColor: b, accentColor: a })
            });
            showToast('🎨', 'Tema uygulandı');
        }

        async function resetColors() {
            try {
                await fetch('/admin/site-settings', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ theme: 'Varsayılan', primaryColor: '#8b5cf6', secondaryColor: '#ec4899', bgColor: '#0a0a1a', accentColor: '#10b981' }) });
                showToast('🔄', 'Ayarlar sıfırlandı');
                setTimeout(loadSiteSettings, 500);
            } catch(e) {}
        }

        async function saveAllSettings() {
            const name = document.getElementById('mod-sitename').value;
            const welcome = document.getElementById('mod-welcome').value;
            await fetch('/admin/site-settings', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ siteName: name, welcomeMessage: welcome })
            });
            showToast('✅', 'Ayarlar kaydedildi');
        }

        async function applyCustomCss() {
            const css = document.getElementById('custom-css-input').value;
            try {
                await fetch('/admin/site-settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ customCss: css })
                });
                showToast('💻', 'CSS Uygulandı');
            } catch(e) {}
        }

        async function clearCustomCss() {
            document.getElementById('custom-css-input').value = '';
            try {
                await fetch('/admin/site-settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ customCss: '' })
                });
                showToast('🗑️', 'CSS Temizlendi');
            } catch(e) {}
        }

        async function loadSiteSettings() {
            try {
                const res = await fetch('/admin/site-settings');
                const data = await res.json();
                if (data.success) {
                    const s = data.settings;
                    if(s.primaryColor) {
                        document.getElementById('cp-primary').value = s.primaryColor;
                        document.getElementById('ct-primary').value = s.primaryColor;
                        previewColor('primary', s.primaryColor);
                    }
                    if(s.secondaryColor) {
                        document.getElementById('cp-secondary').value = s.secondaryColor;
                        document.getElementById('ct-secondary').value = s.secondaryColor;
                        previewColor('secondary', s.secondaryColor);
                    }
                    if(s.bgColor) {
                        document.getElementById('cp-bg').value = s.bgColor;
                        document.getElementById('ct-bg').value = s.bgColor;
                    }
                    if(s.accentColor) {
                        document.getElementById('cp-accent').value = s.accentColor;
                        document.getElementById('ct-accent').value = s.accentColor;
                    }
                    if(s.fontFamily) document.getElementById('font-select').value = s.fontFamily;
                    if(s.siteName) {
                        document.getElementById('mod-sitename').value = s.siteName;
                        if(document.getElementById('preview-name')) document.getElementById('preview-name').textContent = s.siteName;
                    }
                    if(s.welcomeMessage) {
                        document.getElementById('mod-welcome').value = s.welcomeMessage;
                        if(document.getElementById('preview-msg')) document.getElementById('preview-msg').textContent = s.welcomeMessage;
                    }
                    if(s.borderRadius !== undefined) {
                        if(document.getElementById('radius-slider')) document.getElementById('radius-slider').value = s.borderRadius;
                        if(document.getElementById('radius-val')) document.getElementById('radius-val').textContent = s.borderRadius;
                    }
                    if(s.cardOpacity !== undefined) {
                        if(document.getElementById('opacity-slider')) document.getElementById('opacity-slider').value = s.cardOpacity;
                        if(document.getElementById('opacity-val')) document.getElementById('opacity-val').textContent = s.cardOpacity;
                    }
                    if(s.animSpeed !== undefined) {
                        if(document.getElementById('anim-select')) document.getElementById('anim-select').value = s.animSpeed;
                    }
                    
                    if(s.enableVoiceChat !== undefined) document.getElementById('ft-voice').checked = s.enableVoiceChat;
                    if(s.enableVideoChat !== undefined) document.getElementById('ft-video').checked = s.enableVideoChat;
                    if(s.enableGames !== undefined) document.getElementById('ft-games').checked = s.enableGames;
                    if(s.enableMatchmaking !== undefined) document.getElementById('ft-match').checked = s.enableMatchmaking;
                    if(s.maxRoomSeats !== undefined) document.getElementById('mod-seats').value = s.maxRoomSeats.toString();
                    if(s.customCss) document.getElementById('custom-css-input').value = s.customCss;
                }
            } catch (e) {
            }
        }

`;
    html = html.substring(0, start) + code + html.substring(end);
    fs.writeFileSync('admin-dashboard.html', html, 'utf8');
    console.log('JS REPLACED');
} else {
    console.log('MARKERS NOT FOUND', start, end);
}

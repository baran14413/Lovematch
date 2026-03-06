const fs = require('fs');
const html = fs.readFileSync('admin-dashboard.html', 'utf8');

const startMarker = '<!-- SITE MANAGEMENT PAGE -->';
const startIdx = html.indexOf(startMarker);
if (startIdx === -1) { console.error('Start marker not found!'); process.exit(1); }

const pageOpenTag = 'id="page-sitemanage"';
const pageStart = html.indexOf(pageOpenTag, startIdx);
if (pageStart === -1) { console.error('page-sitemanage not found!'); process.exit(1); }

// Find the actual < before the id attribute
const divStart = html.lastIndexOf('<', pageStart);
console.log('Div opens at char:', divStart);

// Walk and count depth
let depth = 0, i = divStart, endIdx = -1;
while (i < html.length - 1) {
    const ch = html[i];
    if (ch === '<') {
        // check for <div (not </div)
        if (html[i + 1] !== '/' && html.slice(i, i + 4).toLowerCase() === '<div') {
            depth++;
        } else if (html.slice(i, i + 6).toLowerCase() === '</div>') {
            depth--;
            if (depth === 0) { endIdx = i + 6; break; }
        } else if (html.slice(i, i + 6).toLowerCase() === '</div ') {
            depth--;
            if (depth === 0) { endIdx = i + 6; break; }
        }
    }
    i++;
}

if (endIdx === -1) { console.error('End not found! depth:', depth); process.exit(1); }
console.log('Found page: chars', startIdx, 'to', endIdx);

const newPage = `<!-- SITE MANAGEMENT PAGE -->
                <div id="page-sitemanage" class="page">
                    <div class="page-title">&#127912; Site &#214;zelle&#351;tirme</div>
                    <div class="page-subtitle">Renk, font, &#246;zellik ve genel ayarlar &#8212; anl&#305;k kayıt</div>

                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:16px;">

                        <div class="panel-card">
                            <div class="panel-header">
                                <div class="panel-title">&#127912; Renkler</div>
                                <button class="action-btn" onclick="resetColors()" style="font-size:11px;padding:3px 10px;">&#8617; S&#305;f&#305;rla</button>
                            </div>
                            <div class="panel-body" style="display:flex;flex-direction:column;gap:14px;">
                                <div class="color-row"><label class="color-label">Ana Renk</label>
                                    <div style="display:flex;align-items:center;gap:8px;">
                                        <input type="color" id="cp-primary" class="color-picker" value="#8b5cf6" oninput="previewColor('primary',this.value)" onchange="saveColor('primaryColor',this.value)">
                                        <input type="text" id="ct-primary" class="color-text" value="#8b5cf6" onchange="syncColorPicker('primary',this.value)">
                                    </div></div>
                                <div class="color-row"><label class="color-label">&#304;kincil Renk</label>
                                    <div style="display:flex;align-items:center;gap:8px;">
                                        <input type="color" id="cp-secondary" class="color-picker" value="#ec4899" oninput="previewColor('secondary',this.value)" onchange="saveColor('secondaryColor',this.value)">
                                        <input type="text" id="ct-secondary" class="color-text" value="#ec4899" onchange="syncColorPicker('secondary',this.value)">
                                    </div></div>
                                <div class="color-row"><label class="color-label">Arkaplan</label>
                                    <div style="display:flex;align-items:center;gap:8px;">
                                        <input type="color" id="cp-bg" class="color-picker" value="#0a0a1a" oninput="previewColor('bg',this.value)" onchange="saveColor('bgColor',this.value)">
                                        <input type="text" id="ct-bg" class="color-text" value="#0a0a1a" onchange="syncColorPicker('bg',this.value)">
                                    </div></div>
                                <div class="color-row"><label class="color-label">Vurgu (Accent)</label>
                                    <div style="display:flex;align-items:center;gap:8px;">
                                        <input type="color" id="cp-accent" class="color-picker" value="#10b981" oninput="previewColor('accent',this.value)" onchange="saveColor('accentColor',this.value)">
                                        <input type="text" id="ct-accent" class="color-text" value="#10b981" onchange="syncColorPicker('accent',this.value)">
                                    </div></div>
                                <div>
                                    <div class="color-label" style="margin-bottom:8px;">&#127919; Haz&#305;r Temalar</div>
                                    <div style="display:flex;flex-wrap:wrap;gap:6px;">
                                        <button class="theme-preset-btn" style="background:linear-gradient(135deg,#8b5cf6,#ec4899)" onclick="applyTheme('#8b5cf6','#ec4899','#0a0a1a','#10b981')" title="Varsay&#305;lan"></button>
                                        <button class="theme-preset-btn" style="background:linear-gradient(135deg,#3b82f6,#06b6d4)" onclick="applyTheme('#3b82f6','#06b6d4','#0f172a','#10b981')" title="Okyanus"></button>
                                        <button class="theme-preset-btn" style="background:linear-gradient(135deg,#f97316,#ef4444)" onclick="applyTheme('#f97316','#ef4444','#1a0a00','#fbbf24')" title="Ate&#351;"></button>
                                        <button class="theme-preset-btn" style="background:linear-gradient(135deg,#10b981,#06b6d4)" onclick="applyTheme('#10b981','#06b6d4','#0a1a0f','#8b5cf6')" title="Orman"></button>
                                        <button class="theme-preset-btn" style="background:linear-gradient(135deg,#eab308,#f97316)" onclick="applyTheme('#eab308','#f97316','#1a1200','#ef4444')" title="Alt&#305;n"></button>
                                        <button class="theme-preset-btn" style="background:linear-gradient(135deg,#ec4899,#8b5cf6)" onclick="applyTheme('#ec4899','#8b5cf6','#1a0010','#10b981')" title="Pembe"></button>
                                        <button class="theme-preset-btn" style="background:linear-gradient(135deg,#64748b,#94a3b8)" onclick="applyTheme('#64748b','#94a3b8','#0f1623','#3b82f6')" title="Gri"></button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="panel-card">
                            <div class="panel-header"><div class="panel-title">&#128288; Tipografi &amp; G&#246;r&#252;n&#252;m</div></div>
                            <div class="panel-body" style="display:flex;flex-direction:column;gap:16px;">
                                <div>
                                    <label class="color-label">Yaz&#305; Tipi</label>
                                    <select id="font-select" class="mod-select" onchange="saveFont(this.value)">
                                        <option value="Inter">Inter (Varsay&#305;lan)</option>
                                        <option value="Poppins">Poppins</option>
                                        <option value="Outfit">Outfit</option>
                                        <option value="Nunito">Nunito</option>
                                        <option value="Roboto">Roboto</option>
                                        <option value="Space Grotesk">Space Grotesk</option>
                                        <option value="DM Sans">DM Sans</option>
                                        <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                                        <option value="Raleway">Raleway</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="color-label">K&#246;&#351;e Yuvarlakl&#305;&#287;&#305; &#8212; <span id="radius-val">16</span>px</label>
                                    <input type="range" id="radius-slider" class="mod-slider" min="0" max="32" value="16"
                                        oninput="document.getElementById('radius-val').textContent=this.value"
                                        onchange="saveSetting('borderRadius',this.value)">
                                </div>
                                <div>
                                    <label class="color-label">Kart Opasitesi &#8212; <span id="opacity-val">70</span>%</label>
                                    <input type="range" id="opacity-slider" class="mod-slider" min="10" max="100" value="70"
                                        oninput="document.getElementById('opacity-val').textContent=this.value"
                                        onchange="saveSetting('cardOpacity',this.value)">
                                </div>
                                <div id="live-preview-card" style="background:linear-gradient(135deg,#8b5cf6,#ec4899);border-radius:12px;padding:16px;color:white;text-align:center;transition:all 0.4s;">
                                    <div style="font-size:18px;font-weight:700;margin-bottom:4px;" id="preview-name">Lovematch Clone</div>
                                    <div style="font-size:12px;opacity:0.8;" id="preview-msg">Ho&#351; geldiniz! &#127881;</div>
                                    <div style="display:flex;gap:6px;justify-content:center;margin-top:10px;">
                                        <span style="background:rgba(255,255,255,0.2);border-radius:6px;padding:4px 10px;font-size:11px;">Buton</span>
                                        <span style="background:rgba(255,255,255,0.1);border-radius:6px;padding:4px 10px;font-size:11px;">&#304;kincil</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="panel-card">
                            <div class="panel-header">
                                <div class="panel-title">&#9881;&#65039; Genel Ayarlar</div>
                                <button class="action-btn primary" onclick="saveAllSettings()" style="font-size:11px;padding:4px 12px;">&#128190; Kaydet</button>
                            </div>
                            <div class="panel-body" style="display:flex;flex-direction:column;gap:14px;">
                                <div><label class="color-label">Site Ad&#305;</label>
                                    <input type="text" id="mod-sitename" class="broadcast-input" value="Lovematch Clone" style="margin:0;"></div>
                                <div><label class="color-label">Ho&#351; Geldin Mesaj&#305;</label>
                                    <input type="text" id="mod-welcome" class="broadcast-input" value="Ho&#351; geldiniz! &#127881;" style="margin:0;"></div>
                                <div><label class="color-label">Max Oda Koltu&#287;u</label>
                                    <select id="mod-seats" class="mod-select" onchange="saveSetting('maxRoomSeats',parseInt(this.value))">
                                        <option value="4">4 Koltuk</option>
                                        <option value="6">6 Koltuk</option>
                                        <option value="8" selected>8 Koltuk</option>
                                        <option value="10">10 Koltuk</option>
                                        <option value="12">12 Koltuk</option>
                                    </select></div>
                                <div style="display:flex;flex-direction:column;gap:8px;">
                                    <div class="color-label">&#128295; &#214;zellikler</div>
                                    <div class="feature-toggle-row"><span>&#128266; Sesli Sohbet</span>
                                        <label class="toggle-switch" style="width:44px;height:24px;"><input type="checkbox" id="ft-voice" checked onchange="saveSetting('enableVoiceChat',this.checked)"><span class="toggle-slider"></span></label></div>
                                    <div class="feature-toggle-row"><span>&#128249; G&#246;r&#252;nt&#252;l&#252; Sohbet</span>
                                        <label class="toggle-switch" style="width:44px;height:24px;"><input type="checkbox" id="ft-video" checked onchange="saveSetting('enableVideoChat',this.checked)"><span class="toggle-slider"></span></label></div>
                                    <div class="feature-toggle-row"><span>&#127918; Oyunlar</span>
                                        <label class="toggle-switch" style="width:44px;height:24px;"><input type="checkbox" id="ft-games" checked onchange="saveSetting('enableGames',this.checked)"><span class="toggle-slider"></span></label></div>
                                    <div class="feature-toggle-row"><span>&#128269; 1v1 E&#351;le&#351;me</span>
                                        <label class="toggle-switch" style="width:44px;height:24px;"><input type="checkbox" id="ft-match" checked onchange="saveSetting('enableMatchmaking',this.checked)"><span class="toggle-slider"></span></label></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="panel-card">
                        <div class="panel-header">
                            <div class="panel-title">&#128187; &#214;zel CSS</div>
                            <div style="display:flex;gap:8px;">
                                <button class="action-btn" onclick="clearCustomCss()" style="font-size:11px;padding:4px 10px;color:var(--accent-red);">&#128465;&#65039; Temizle</button>
                                <button class="action-btn primary" onclick="applyCustomCss()" style="font-size:11px;padding:4px 12px;">&#9654; Uygula</button>
                            </div>
                        </div>
                        <div class="panel-body">
                            <p style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">T&#252;m kullan&#305;c&#305;lara anl&#305;k yans&#305;r. Dikkatli kullan&#305;n.</p>
                            <textarea id="custom-css-input" style="width:100%;min-height:100px;padding:12px;border-radius:10px;border:1px solid var(--border);background:rgba(0,0,0,0.3);color:var(--text-primary);font-family:monospace;font-size:12px;resize:vertical;outline:none;box-sizing:border-box;" placeholder="/* Ornek: */ :root { --accent-purple: #ff6b35; }"></textarea>
                        </div>
                    </div>
                </div>`;

const result = html.slice(0, startIdx) + newPage + html.slice(endIdx);
fs.writeFileSync('admin-dashboard.html', result, 'utf8');
console.log('SUCCESS - Page replaced!');

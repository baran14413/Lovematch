const fs = require('fs');
let html = fs.readFileSync('admin-dashboard.html', 'utf8');

const endStyleStr = '</style>';

const end = html.lastIndexOf(endStyleStr);

if (end > -1) {
    const css = `
        /* MODULAR SETTINGS CSS */
        .color-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .color-label {
            font-size: 11px;
            color: var(--text-muted);
            text-transform: uppercase;
            font-weight: 600;
        }
        .color-picker {
            width: 28px;
            height: 28px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            padding: 0;
            background: none;
        }
        .color-picker::-webkit-color-swatch-wrapper {
            padding: 0;
        }
        .color-picker::-webkit-color-swatch {
            border: 2px solid rgba(255,255,255,0.1);
            border-radius: 6px;
        }
        .color-text {
            width: 70px;
            background: rgba(0,0,0,0.3);
            border: 1px solid var(--border);
            border-radius: 6px;
            padding: 4px 8px;
            color: var(--text-primary);
            font-family: monospace;
            font-size: 11px;
            outline: none;
            text-align: center;
        }
        .theme-preset-btn {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            border: 2px solid transparent;
            cursor: pointer;
            transition: transform 0.2s;
        }
        .theme-preset-btn:hover {
            transform: scale(1.15);
            border-color: white;
        }
        .mod-select, .broadcast-input {
            width: 100%;
            background: rgba(0,0,0,0.3);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 8px 12px;
            color: var(--text-primary);
            font-size: 12px;
            outline: none;
            margin-top: 6px;
            transition: border-color 0.2s;
            box-sizing: border-box;
        }
        .mod-select:focus, .broadcast-input:focus {
            border-color: var(--accent-purple);
        }
        .mod-slider {
            -webkit-appearance: none;
            width: 100%;
            height: 4px;
            background: rgba(255,255,255,0.1);
            border-radius: 4px;
            outline: none;
            margin-top: 10px;
        }
        .mod-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: var(--text-primary);
            cursor: pointer;
        }
        .feature-toggle-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: rgba(255,255,255,0.02);
            padding: 8px 12px;
            border-radius: 8px;
            font-size: 12px;
            color: var(--text-secondary);
        }

    `;
    html = html.substring(0, end) + css + html.substring(end);
    fs.writeFileSync('admin-dashboard.html', html, 'utf8');
    console.log('CSS INSERTED');
} else {
    console.log('</style> NOT FOUND');
}

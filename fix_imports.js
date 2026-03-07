const fs = require('fs');
const path = require('path');

function processDirectory(dirPath) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
            processDirectory(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.rs')) {
            processFile(fullPath);
        }
    }
}

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Check if the file starts with the injected import
    const injectedLine = 'use tracing::{info, debug, warn};\n';
    const injectedLineWin = 'use tracing::{info, debug, warn};\r\n';

    let hasInjected = false;
    if (content.startsWith(injectedLine)) {
        content = content.substring(injectedLine.length);
        hasInjected = true;
    } else if (content.startsWith(injectedLineWin)) {
        content = content.substring(injectedLineWin.length);
        hasInjected = true;
    }

    // Also remove any rogue `use tracing::{...};` that might be at the top level
    // just to be safe, but let's just rely on the exact startsWith check.

    if (hasInjected) {
        // Split into lines
        const isWin = content.includes('\r\n');
        const lines = content.split(isWin ? '\r\n' : '\n');

        // Find the right place to insert
        let insertIdx = 0;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            // Skip inner doc comments `//!` and empty lines at the very top
            if (line.startsWith('//!') || line === '') {
                insertIdx = i + 1;
            } else if (line.startsWith('//') && !line.startsWith('///')) {
                // Normal comments at the top are fine to skip past too
                insertIdx = i + 1;
            } else {
                break; // Stop at the first real code or item doc (///)
            }
        }

        lines.splice(insertIdx, 0, 'use tracing::{info, debug, warn};');

        fs.writeFileSync(filePath, lines.join(isWin ? '\r\n' : '\n'), 'utf8');
        console.log('Fixed', filePath);
    }
}

processDirectory(path.join(__dirname, 'Vaughan', 'src-tauri', 'src'));
console.log('Done!');

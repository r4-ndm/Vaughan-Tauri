const fs = require('fs');
const path = require('path');

function processDirectory(dirPath) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        // Skip monitoring and lib.rs/state.rs since we already manually migrated those
        if (entry.isDirectory()) {
            if (entry.name !== 'monitoring' && entry.name !== 'target') {
                processDirectory(fullPath);
            }
        } else if (entry.isFile() && entry.name.endsWith('.rs')) {
            if (entry.name !== 'lib.rs' && entry.name !== 'state.rs') {
                processFile(fullPath);
            }
        }
    }
}

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    if (!content.includes('println!') && !content.includes('eprintln!')) {
        return; // Nothing to change
    }

    // 1. Replace the logging macros
    let newContent = content.replace(/\bprintln!\(/g, 'info!(');
    newContent = newContent.replace(/\beprintln!\(/g, 'debug!(');

    // 2. Add the imports if missing
    if (!newContent.includes('use tracing::')) {
        let lines = newContent.split('\n');
        let insertIdx = 0;

        // Skip rust inner doc comments `//!` and blank lines at the top
        for (let i = 0; i < lines.length; i++) {
            let trimmed = lines[i].trim();
            if (trimmed.startsWith('//!') || trimmed === '') {
                insertIdx = i + 1;
            } else if (trimmed.startsWith('#![')) {
                insertIdx = i + 1;
            } else {
                break;
            }
        }

        lines.splice(insertIdx, 0, 'use tracing::{debug, info, warn};');
        newContent = lines.join('\n');
    }

    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Migrated ${filePath}`);
}

processDirectory(path.join(__dirname, 'Vaughan', 'src-tauri', 'src'));

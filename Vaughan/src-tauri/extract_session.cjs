const fs = require('fs');
let code = fs.readFileSync('src/dapp/session.rs', 'utf8');

// The exact lines we want to remove
const targets = [
    '/// Type alias for session key (window_label is now part of the key)',
    '/// This ensures sessions are isolated per window',
    'pub type SessionKey = (String, String);',
    '',
    '/// dApp origin (e.g., "https://app.uniswap.org")',
    'pub type DappOrigin = String;',
    '',
    '/// dApp connection information',
    '#[derive(Debug, Clone, Serialize, Deserialize)]',
    'pub struct DappConnection {',
    '    /// Window label (unique per window)',
    '    pub window_label: String,',
    '',
    '    /// dApp origin (e.g., "https://app.uniswap.org")',
    '    pub origin: String,',
    '',
    '    /// dApp name (if provided)',
    '    pub name: Option<String>,',
    '',
    '    /// dApp icon URL (if provided)',
    '    pub icon: Option<String>,',
    '',
    '    /// Connected accounts (addresses the dApp can see)',
    '    pub accounts: Vec<Address>,',
    '',
    '    /// Connection timestamp (Unix timestamp)',
    '    pub connected_at: u64,',
    '',
    '    /// Last activity timestamp (Unix timestamp)',
    '    pub last_activity: u64,',
    '}',
];

const implTargetStart = 'impl DappConnection {';
const implTargetEnd = '    }\n}';

// 1. Remove the struct and types
let lines = code.split('\n');
let filtered = [];
let i = 0;

let inImplBlock = false;

while (i < lines.length) {
    let line = lines[i];
    let trimmed = line.trim();

    if (targets.some(t => line.includes(t))) {
        // Skip
        i++;
        continue;
    }

    if (line.includes(implTargetStart)) {
        inImplBlock = true;
        i++;
        continue;
    }

    if (inImplBlock) {
        if (line === implTargetEnd || line === '}') {
            // Need to check if we are actually at the end of the impl block
            // Quick and dirty: we know the DappConnection impl is exactly 22 lines long
            inImplBlock = false;
        }
        i++;
        continue;
    }

    filtered.push(line);
    i++;
}

code = filtered.join('\n');

// Use Regex to be absolutely sure the impl block is gone
code = code.replace(/impl DappConnection \{[\s\S]*?last_activity:\s*now,\s*\}\s*\}/, '');

// 2. Add the import
if (!code.includes('models::dapp')) {
    code = code.replace(
        'use tokio::sync::RwLock;',
        'use tokio::sync::RwLock;\nuse crate::models::dapp::{DappConnection, DappOrigin, SessionKey};'
    );
}

// 3. Clean up the unused SystemTime import
code = code.replace('use std::time::{SystemTime, UNIX_EPOCH};\n', '');

fs.writeFileSync('src/dapp/session.rs', code, 'utf8');
console.log('Processed session.rs');

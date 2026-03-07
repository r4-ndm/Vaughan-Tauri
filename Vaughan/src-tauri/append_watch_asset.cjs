const fs = require('fs');

// Read the utf-16 file that powershell outputted, and convert it
const buffer = fs.readFileSync('temp_rpc_handler.rs');
const code = buffer.toString('utf16le');

const lines = code.split('\n');

// Grab from line 1022 to the end
const watchAssetLines = lines.slice(1022).join('\n');

// Standardize it to pub(crate)
const fixedPubCrate = watchAssetLines.replace(/^async fn /gm, 'pub(crate) async fn ');

// Append to wallet.rs
const walletContent = fs.readFileSync('src/dapp/rpc/wallet.rs', 'utf8');
fs.writeFileSync('src/dapp/rpc/wallet.rs', walletContent + '\n' + fixedPubCrate, 'utf8');

console.log('Appended wallet_watchAsset to wallet.rs!');

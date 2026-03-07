const fs = require('fs');
let code = fs.readFileSync('src/dapp/rpc_handler.rs', 'utf8');

// 1. Add module declarations at the top
code = code.replace(
    'use tauri::{AppHandle, Emitter, Manager};',
    'pub mod eth;\npub mod personal;\npub mod wallet;\n\nuse tauri::{AppHandle, Emitter, Manager};'
);

// 2. We need to replace ALL the handle_* functions with nothing, because they live in the submodules now.
// We literally just slice off the bottom of the file from line 87.
const lines = code.split('\n');
const handleRequestBoundary = lines.findIndex(line => line.includes('// Account Management Handlers')) - 1;

let newCode = lines.slice(0, handleRequestBoundary).join('\n') + '\n';

// 3. Now we must rewrite the `match method.as_str()` block in `handle_request` to point to the submodules.
newCode = newCode.replace(/handle_request_accounts\(state, window_label, origin\)/g, 'eth::handle_request_accounts(state, window_label, origin)');
newCode = newCode.replace(/handle_accounts\(state, window_label, origin\)/g, 'eth::handle_accounts(state, window_label, origin)');
newCode = newCode.replace(/handle_chain_id\(state\)/g, 'eth::handle_chain_id(state)');
newCode = newCode.replace(/handle_net_version\(state\)/g, 'eth::handle_net_version(state)');
newCode = newCode.replace(/handle_get_balance\(state, params\)/g, 'eth::handle_get_balance(state, params)');
newCode = newCode.replace(/handle_block_number\(state\)/g, 'eth::handle_block_number(state)');
newCode = newCode.replace(/handle_call\(state, params\)/g, 'eth::handle_call(state, params)');
newCode = newCode.replace(/handle_estimate_gas\(state, params\)/g, 'eth::handle_estimate_gas(state, params)');
newCode = newCode.replace(/handle_gas_price\(state\)/g, 'eth::handle_gas_price(state)');
newCode = newCode.replace(/handle_get_transaction_count\(state, params\)/g, 'eth::handle_get_transaction_count(state, params)');
newCode = newCode.replace(/handle_get_transaction_by_hash\(state, params\)/g, 'eth::handle_get_transaction_by_hash(state, params)');
newCode = newCode.replace(/handle_get_transaction_receipt\(state, params\)/g, 'eth::handle_get_transaction_receipt(state, params)');
newCode = newCode.replace(/handle_send_transaction\(app, state, window_label, origin, params\)/g, 'eth::handle_send_transaction(app, state, window_label, origin, params)');

newCode = newCode.replace(/handle_personal_sign\(app, state, window_label, origin, params\)/g, 'personal::handle_personal_sign(app, state, window_label, origin, params)');
newCode = newCode.replace(/handle_sign_typed_data_v4\(app, state, window_label, origin, params\)/g, 'personal::handle_sign_typed_data_v4(app, state, window_label, origin, params)');

newCode = newCode.replace(/handle_switch_chain\(state, window_label, origin, params\)/g, 'wallet::handle_switch_chain(state, window_label, origin, params)');
newCode = newCode.replace(/handle_add_chain\(state, window_label, origin, params\)/g, 'wallet::handle_add_chain(state, window_label, origin, params)');

fs.writeFileSync('src/dapp/rpc/mod.rs', newCode, 'utf8');
console.log('Created rpc/mod.rs router!');
// Delete the old giant file
fs.unlinkSync('src/dapp/rpc_handler.rs');

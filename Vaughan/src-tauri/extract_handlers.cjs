const fs = require('fs');
const code = fs.readFileSync('src/dapp/rpc_handler.rs', 'utf8');
const lines = code.split('\n');

const personalLines = lines.slice(610, 827); // handle_personal_sign and handle_sign_typed_data_v4
const walletLines = lines.slice(827, 1022); // Switch chain, Add chain, Permissions

const personalPrefix = `
use crate::error::WalletError;
use crate::state::VaughanState;
use alloy::primitives::{Address, B256};
use serde_json::Value;
use tauri::{AppHandle, Manager};
use tracing::{debug, error, info};
use alloy::signers::local::PrivateKeySigner;
use alloy::signers::Signer;
use std::str::FromStr;
use std::time::SystemTime;
use crate::dapp::approval::{ApprovalRequest, ApprovalRequestType};

`;

const walletPrefix = `
use crate::error::WalletError;
use crate::state::VaughanState;
use serde_json::{json, Value};
use tracing::{debug, error, info, warn};
use std::time::SystemTime;
use crate::dapp::approval::{ApprovalRequest, ApprovalRequestType};

`;

fs.writeFileSync('src/dapp/rpc/personal.rs', personalPrefix + personalLines.join('\n'), 'utf8');
fs.writeFileSync('src/dapp/rpc/wallet.rs', walletPrefix + walletLines.join('\n'), 'utf8');
console.log('Created rpc/personal.rs and rpc/wallet.rs');

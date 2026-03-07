const fs = require('fs');
const code = fs.readFileSync('src/dapp/rpc_handler.rs', 'utf8');
const lines = code.split('\n');

// We are going to extract lines 93 to 408 (ethereum read methods)
// and lines 414 to 609 (send_transaction)
// We also need to extract 611 to 827 (signing methods) for personal.rs later.

// Let's just create eth.rs right now using the extracted lines directly from the AST/string:

const ethMethodsStart = 88; // Start of Account Management Handlers
const ethMethodsEnd = 609; // End of handle_send_transaction

const ethLines = lines.slice(ethMethodsStart - 1, ethMethodsEnd);

const prefix = `
use crate::error::WalletError;
use crate::state::VaughanState;
use alloy::primitives::{Address, U256};
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager};
use tracing::{debug, error, info, warn};
use alloy::consensus::TxLegacy;
use alloy::network::TransactionBuilder;
use alloy::rpc::types::TransactionRequest;
use alloy::signers::local::PrivateKeySigner;
use std::str::FromStr;
use std::time::SystemTime;
use crate::commands::transaction::{estimate_gas_internal, send_transaction_internal};
use crate::dapp::approval::{ApprovalRequest, ApprovalRequestType};

`;

fs.writeFileSync('src/dapp/rpc/eth.rs', prefix + ethLines.join('\n'), 'utf8');
console.log('Created rpc/eth.rs');

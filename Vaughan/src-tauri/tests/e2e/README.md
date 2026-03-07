# End-to-End (E2E) Testing Strategy

This directory contains the foundation for End-to-End testing of the Vaughan Wallet.

## Goal
Verify the entire application stack, from the Tauri frontend to the Rust backend and simulated blockchain networks.

## Tools
- **Frontend Driver**: Playwright (recommended) or WebDriver.
- **Backend Driver**: `tauri-driver` (WebDriver implementation for Tauri).

## Structure
- `specs/`: E2E test specifications (gherkin or similar).
- `fixtures/`: Test data and setup scripts.
- `screenshots/`: Captured screenshots from failures.

## Next Steps (Phase 4)
1. Install Playwright: `npm init playwright@latest`
2. Configure Tauri to run in test mode.
3. Write login flow test.

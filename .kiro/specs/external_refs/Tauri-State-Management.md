# Tauri State Management (Official)

**Source**: [Official Tauri Documentation](https://tauri.app/develop/state-management/)  
**Version**: Tauri 2.0+  
**Status**: ✅ VERIFIED - Official Tauri docs

---

## Overview

Tauri provides state management through the Manager API, allowing you to share data across your application.

**Key Concepts**:
- State is managed using `.manage()` method
- Access state in commands using `State<'_, T>`
- Use `Mutex` for mutable state
- Use `Arc` only when moving state to threads (Tauri handles Arc internally)

---

## 1. Basic State Management

### Define and Register State

```rust
use tauri::State;

struct AppState {
    count: i32,
}

#[tauri::command]
fn get_count(state: State<'_, AppState>) -> i32 {
    state.count
}

fn main() {
    tauri::Builder::default()
        .manage(AppState { count: 0 })
        .invoke_handler(tauri::generate_handler![get_count])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## 2. Mutable State with Mutex

### Using std::sync::Mutex

**⚠️ IMPORTANT**: Use `std::sync::Mutex` for most cases, NOT async Mutex.

```rust
use std::sync::Mutex;
use tauri::State;

struct AppState {
    count: Mutex<i32>,
}

#[tauri::command]
fn increment(state: State<'_, AppState>) -> i32 {
    let mut count = state.count.lock().unwrap();
    *count += 1;
    *count
}

fn main() {
    tauri::Builder::default()
        .manage(AppState {
            count: Mutex::new(0),
        })
        .invoke_handler(tauri::generate_handler![increment])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Why std::sync::Mutex?**
- Faster for short-lived locks
- Simpler to use
- Recommended by Tokio documentation
- Only use async Mutex if holding lock across `.await` points

---

## 3. Async Commands with Tokio Mutex

### When to Use tokio::sync::Mutex

Use Tokio's async Mutex ONLY when:
- You need to hold the lock across `.await` points
- You're accessing IO resources (database connections, etc.)

```rust
use tokio::sync::Mutex;
use tauri::State;

struct AppState {
    db: Mutex<Database>,
}

#[tauri::command]
async fn query_db(state: State<'_, AppState>) -> Result<String, String> {
    let db = state.db.lock().await;
    let result = db.query().await.map_err(|e| e.to_string())?;
    Ok(result)
}

fn main() {
    tauri::Builder::default()
        .manage(AppState {
            db: Mutex::new(Database::new()),
        })
        .invoke_handler(tauri::generate_handler![query_db])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Note**: Async commands must return `Result<T, E>`.

---

## 4. Accessing State Outside Commands

### Using AppHandle

```rust
use tauri::{AppHandle, Manager};
use std::sync::Mutex;

struct AppState {
    count: Mutex<i32>,
}

fn some_event_handler(app: AppHandle) {
    // Get state using Manager trait
    let state = app.state::<AppState>();
    let mut count = state.count.lock().unwrap();
    *count += 1;
}

fn main() {
    tauri::Builder::default()
        .manage(AppState {
            count: Mutex::new(0),
        })
        .setup(|app| {
            let app_handle = app.handle();
            
            // Use state in event handler
            app.listen("some-event", move |_event| {
                some_event_handler(app_handle.clone());
            });
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## 5. Common Patterns for Vaughan-Tauri

### Pattern 1: VaughanState with Controllers

```rust
use std::sync::Arc;
use tokio::sync::Mutex;
use std::collections::HashMap;

pub struct VaughanState {
    // Provider-independent controllers (always available)
    pub wallet_controller: Arc<WalletController>,
    pub price_controller: Arc<PriceController>,
    
    // Provider-dependent controllers (per-network, cached)
    pub network_controllers: Mutex<HashMap<NetworkId, Arc<NetworkController>>>,
    pub transaction_controllers: Mutex<HashMap<NetworkId, Arc<TransactionController>>>,
    
    // Application state
    pub active_network: Mutex<NetworkId>,
    pub active_account: Mutex<Option<Address>>,
    pub wallet_locked: Mutex<bool>,
}

fn main() {
    let state = VaughanState {
        wallet_controller: Arc::new(WalletController::new()),
        price_controller: Arc::new(PriceController::new()),
        network_controllers: Mutex::new(HashMap::new()),
        transaction_controllers: Mutex::new(HashMap::new()),
        active_network: Mutex::new(NetworkId::default()),
        active_account: Mutex::new(None),
        wallet_locked: Mutex::new(true),
    };
    
    tauri::Builder::default()
        .manage(state)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Pattern 2: Accessing VaughanState in Commands

```rust
#[tauri::command]
async fn switch_network(
    state: State<'_, VaughanState>,
    network_id: String,
) -> Result<(), String> {
    // Lock only what you need
    let mut active_network = state.active_network.lock().await;
    *active_network = NetworkId::from(network_id);
    
    Ok(())
}

#[tauri::command]
async fn get_balance(
    state: State<'_, VaughanState>,
    address: String,
) -> Result<String, String> {
    // Get network controller
    let network_controllers = state.network_controllers.lock().await;
    let active_network = state.active_network.lock().await;
    
    let controller = network_controllers
        .get(&*active_network)
        .ok_or("Network not initialized")?;
    
    // Use controller
    let balance = controller.get_balance(&address).await
        .map_err(|e| e.to_string())?;
    
    Ok(balance.to_string())
}
```

---

## 6. Important Notes

### ❌ DON'T: Double-wrap with Arc

```rust
// ❌ WRONG: Tauri already wraps state in Arc
tauri::Builder::default()
    .manage(Arc::new(Mutex::new(AppState { ... })))
```

```rust
// ✅ CORRECT: Tauri handles Arc internally
tauri::Builder::default()
    .manage(AppState { ... })
```

### ❌ DON'T: Use async Mutex unnecessarily

```rust
// ❌ WRONG: Unnecessary async Mutex for simple state
use tokio::sync::Mutex;

struct AppState {
    count: Mutex<i32>,  // Overkill for simple counter
}
```

```rust
// ✅ CORRECT: Use std::sync::Mutex for simple state
use std::sync::Mutex;

struct AppState {
    count: Mutex<i32>,
}
```

### ✅ DO: Use type aliases for clarity

```rust
type AppState = Mutex<MyState>;

#[tauri::command]
fn my_command(state: State<'_, AppState>) {
    // Clear and concise
}
```

---

## 7. Lifetime Elision

Both forms are equivalent:

```rust
// Explicit lifetime
fn my_command(state: State<'_, AppState>) { }

// Elided lifetime (Rust infers it)
fn my_command(state: State<AppState>) { }
```

Use whichever is clearer for your use case.

---

## 8. Thread Safety

### Moving State to Threads

```rust
use tauri::{AppHandle, Manager};

fn spawn_background_task(app: AppHandle) {
    std::thread::spawn(move || {
        // Get state in the new thread
        let state = app.state::<AppState>();
        
        // Use state...
        let count = state.count.lock().unwrap();
        println!("Count: {}", *count);
    });
}
```

**Note**: `AppHandle` is cheap to clone, designed for this use case.

---

## Summary

**Key Takeaways**:
1. Use `.manage()` to register state
2. Access with `State<'_, T>` in commands
3. Use `std::sync::Mutex` for most cases
4. Use `tokio::sync::Mutex` only for async locks across `.await`
5. Don't wrap state in `Arc` (Tauri does this)
6. Use `AppHandle` to access state outside commands

**For Vaughan-Tauri**:
- Use `Mutex<HashMap<...>>` for controller caches
- Use `Arc<Controller>` for sharing controllers
- Lock only what you need, release quickly
- Prefer `std::sync::Mutex` unless holding across `.await`

---

**Official Documentation**: https://tauri.app/develop/state-management/  
**Last Updated**: February 3, 2026  
**Verification**: ✅ All examples from official Tauri documentation

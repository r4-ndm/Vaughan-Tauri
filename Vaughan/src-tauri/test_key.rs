use keyring::Entry;
fn main() {
    let entry = Entry::new("vaughan-wallet", "seed").unwrap();
    println!("Exists? {}", entry.get_password().is_ok());
    if entry.get_password().is_ok() {
        println!("Deleting...");
        let res = entry.delete_password();
        println!("Deleted ok? {}", res.is_ok());
        println!("Still exists? {}", entry.get_password().is_ok());
    }
}

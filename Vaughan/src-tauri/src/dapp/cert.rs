///! Self-Signed Certificate Generation for WSS
///!
///! Generates and manages self-signed certificates for secure WebSocket (WSS)
///! connections to localhost. This allows HTTPS sites to connect to the wallet.

use rcgen::{Certificate, CertificateParams, DistinguishedName, DnType, SanType};
use std::fs;
use std::path::PathBuf;
use std::time::SystemTime;

/// Certificate validity period (1 year)
const CERT_VALIDITY_DAYS: u32 = 365;

/// Get the certificate directory path
///
/// Stores certificates in the app's data directory:
/// - Linux: ~/.local/share/vaughan/certs/
/// - macOS: ~/Library/Application Support/vaughan/certs/
/// - Windows: %APPDATA%\vaughan\certs\
fn get_cert_dir() -> Result<PathBuf, String> {
    let app_dir = dirs::data_dir()
        .ok_or("Failed to get app data directory")?
        .join("vaughan")
        .join("certs");
    
    // Create directory if it doesn't exist
    fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create cert directory: {}", e))?;
    
    Ok(app_dir)
}

/// Get paths for certificate and private key
fn get_cert_paths() -> Result<(PathBuf, PathBuf), String> {
    let cert_dir = get_cert_dir()?;
    let cert_path = cert_dir.join("localhost.crt");
    let key_path = cert_dir.join("localhost.key");
    Ok((cert_path, key_path))
}

/// Check if certificate exists and is still valid
fn is_cert_valid(cert_path: &PathBuf) -> bool {
    if !cert_path.exists() {
        return false;
    }
    
    // Check if cert is less than CERT_VALIDITY_DAYS old
    if let Ok(metadata) = fs::metadata(cert_path) {
        if let Ok(modified) = metadata.modified() {
            if let Ok(duration) = SystemTime::now().duration_since(modified) {
                let days = duration.as_secs() / 86400;
                return days < CERT_VALIDITY_DAYS as u64;
            }
        }
    }
    
    false
}

/// Generate a self-signed certificate for localhost
///
/// Creates a certificate valid for:
/// - localhost
/// - 127.0.0.1
/// - ::1 (IPv6 localhost)
///
/// # Returns
///
/// * `Ok((cert_pem, key_pem))` - Certificate and private key in PEM format
/// * `Err(String)` - Error message
fn generate_certificate() -> Result<(String, String), String> {
    eprintln!("[Cert] Generating self-signed certificate for localhost...");
    
    let mut params = CertificateParams::default();
    
    // Set subject
    let mut dn = DistinguishedName::new();
    dn.push(DnType::CommonName, "Vaughan Wallet");
    dn.push(DnType::OrganizationName, "Vaughan");
    params.distinguished_name = dn;
    
    // Add Subject Alternative Names (SANs) for localhost
    params.subject_alt_names = vec![
        SanType::DnsName("localhost".to_string()),
        SanType::IpAddress(std::net::IpAddr::V4(std::net::Ipv4Addr::new(127, 0, 0, 1))),
        SanType::IpAddress(std::net::IpAddr::V6(std::net::Ipv6Addr::new(0, 0, 0, 0, 0, 0, 0, 1))),
    ];
    
    // Generate certificate
    let cert = Certificate::from_params(params)
        .map_err(|e| format!("Failed to generate certificate: {}", e))?;
    
    let cert_pem = cert.serialize_pem()
        .map_err(|e| format!("Failed to serialize certificate: {}", e))?;
    
    let key_pem = cert.serialize_private_key_pem();
    
    eprintln!("[Cert] Certificate generated successfully");
    
    Ok((cert_pem, key_pem))
}

/// Get or generate certificate for WSS
///
/// Checks if a valid certificate exists, otherwise generates a new one.
/// Certificates are cached in the app data directory.
///
/// # Returns
///
/// * `Ok((cert_pem, key_pem))` - Certificate and private key in PEM format
/// * `Err(String)` - Error message
///
/// # Example
///
/// ```rust,no_run
/// let (cert, key) = get_or_generate_cert()?;
/// // Use cert and key to configure TLS
/// ```
pub fn get_or_generate_cert() -> Result<(String, String), String> {
    let (cert_path, key_path) = get_cert_paths()?;
    
    // Check if valid certificate exists
    if is_cert_valid(&cert_path) && key_path.exists() {
        eprintln!("[Cert] Using existing certificate: {:?}", cert_path);
        
        let cert_pem = fs::read_to_string(&cert_path)
            .map_err(|e| format!("Failed to read certificate: {}", e))?;
        
        let key_pem = fs::read_to_string(&key_path)
            .map_err(|e| format!("Failed to read private key: {}", e))?;
        
        return Ok((cert_pem, key_pem));
    }
    
    // Generate new certificate
    eprintln!("[Cert] No valid certificate found, generating new one...");
    let (cert_pem, key_pem) = generate_certificate()?;
    
    // Save certificate and key
    fs::write(&cert_path, &cert_pem)
        .map_err(|e| format!("Failed to save certificate: {}", e))?;
    
    fs::write(&key_path, &key_pem)
        .map_err(|e| format!("Failed to save private key: {}", e))?;
    
    eprintln!("[Cert] Certificate saved to: {:?}", cert_path);
    eprintln!("[Cert] Private key saved to: {:?}", key_path);
    
    Ok((cert_pem, key_pem))
}

/// Get the certificate path for user reference
///
/// Returns the path where the certificate is stored so users can
/// manually trust it if needed.
pub fn get_cert_path_for_display() -> Result<String, String> {
    let (cert_path, _) = get_cert_paths()?;
    Ok(cert_path.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_certificate() {
        let result = generate_certificate();
        assert!(result.is_ok());
        
        let (cert, key) = result.unwrap();
        assert!(cert.contains("BEGIN CERTIFICATE"));
        assert!(key.contains("BEGIN PRIVATE KEY"));
    }

    #[test]
    fn test_get_cert_dir() {
        let result = get_cert_dir();
        assert!(result.is_ok());
    }
}

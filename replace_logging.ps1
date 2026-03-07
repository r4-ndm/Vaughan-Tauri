$files = Get-ChildItem -Path "Vaughan\src-tauri\src" -Recurse -Filter "*.rs"
foreach ($file in $files) {
    $content = Get-Content -Raw -Path $file.FullName
    if ($content -match "println!" -or $content -match "eprintln!") {
        # Replace logging macros
        $newContent = $content -replace "\bprintln!\(", "info!("
        $newContent = $newContent -replace "\beprintln!\(", "debug!("
        
        # Add import if missing
        if ($newContent -notmatch "use tracing::") {
            $newContent = "use tracing::{info, debug, warn};`n" + $newContent
        }
        
        # Save back
        [System.IO.File]::WriteAllText($file.FullName, $newContent, [System.Text.Encoding]::UTF8)
        Write-Host "Updated $($file.Name)"
    }
}

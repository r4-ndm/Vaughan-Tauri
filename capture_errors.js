const { execSync } = require('child_process');
const fs = require('fs');

try {
    const output = execSync('cargo check', {
        cwd: 'Vaughan/src-tauri',
        encoding: 'utf-8',
        stdio: 'pipe'
    });
} catch (error) {
    const lines = error.stderr.split('\n');
    const errorsOnly = lines.filter(line => !line.includes('warning:') && !line.includes('|') && line.trim() !== '');
    fs.writeFileSync('Vaughan/src-tauri/errors.txt', error.stderr, 'utf8');

    // Print first 50 lines to console so I can see what triggered the 300+ errors
    console.log(error.stderr.substring(0, 2000));
}

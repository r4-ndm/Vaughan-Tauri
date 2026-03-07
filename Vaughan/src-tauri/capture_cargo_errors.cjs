const { execSync } = require('child_process');

try {
    execSync('cargo check', { stdio: 'pipe' });
    console.log("SUCCESS");
} catch (error) {
    const output = error.stderr ? error.stderr.toString() : '';
    const lines = output.split('\n');
    const errors = lines.filter(line => line.includes('error['));
    console.log(JSON.stringify(errors, null, 2));

    // Print the first few lines of raw error output to see context
    console.log("--- RAW ERROR CONTEXT ---");
    console.log(lines.slice(0, 30).join('\n'));
}

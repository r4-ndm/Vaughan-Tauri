import os
import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Skip files that don't have println! or eprintln!
    if 'println!' not in content and 'eprintln!' not in content:
        return

    # Skip tests blocks usually ? Actually replacing in tests is fine, or we can just replace everything.
    # Replace eprintln! with debug!
    new_content = re.sub(r'\beprintln!\(', 'debug!(', content)
    # Replace println! with info!
    new_content = re.sub(r'\bprintln!\(', 'info!(', new_content)

    # Add tracing import if not present
    if 'use tracing::' not in new_content:
        # Find the last `use ` statement to insert after, or just after the module declarations
        lines = new_content.split('\n')
        insert_idx = 0
        for i, line in enumerate(lines):
            if line.startswith('use '):
                insert_idx = i + 1
            if line.startswith('pub mod ') and insert_idx == 0:
                insert_idx = i + 1
                
        if insert_idx == 0:
            insert_idx = 1 # Just after first line (usually comments)
            
        lines.insert(insert_idx, 'use tracing::{info, debug, warn};')
        new_content = '\n'.join(lines)
    else:
        # If tracing is imported, make sure info, debug, warn are there.
        # This is a bit tricky, but we can just let rust-analyzer/cargo check tell us if it's wrong, 
        # or just add a generic `use tracing::*;` but let's just do a naive replacement.
        if 'debug' not in new_content and 'use tracing::' in new_content:
            new_content = re.sub(r'use tracing::\{(.*?)\};', r'use tracing::{\1, debug, info, warn};', new_content)
            new_content = re.sub(r'use tracing::([^{;]+);', r'use tracing::{\1, debug, info, warn};', new_content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print(f"Updated {filepath}")

def main():
    src_dir = os.path.join('Vaughan', 'src-tauri', 'src')
    for root, _, files in os.walk(src_dir):
        for file in files:
            if file.endswith('.rs'):
                process_file(os.path.join(root, file))

if __name__ == '__main__':
    main()

/**
 * Patches the generated tauri-commands.ts to reference TAURI_CHANNEL and __makeEvents__,
 * so TypeScript noUnusedLocals does not report them. Run after gen:bindings.
 */
const fs = require("fs");
const path = require("path");

const bindingsPath = path.join(__dirname, "..", "web", "src", "bindings", "tauri-commands.ts");
if (!fs.existsSync(bindingsPath)) {
  console.warn("patch-bindings: bindings file not found, skipping");
  process.exit(0);
}

let content = fs.readFileSync(bindingsPath, "utf8");
const marker = "void [TAURI_CHANNEL, __makeEvents__];";
if (content.includes(marker)) {
  process.exit(0);
}
content = content.trimEnd() + "\nvoid [TAURI_CHANNEL, __makeEvents__];\n";
fs.writeFileSync(bindingsPath, content);
console.log("patch-bindings: applied unused-reference patch");

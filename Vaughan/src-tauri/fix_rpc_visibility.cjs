const fs = require('fs');

const files = [
    'src/dapp/rpc/eth.rs',
    'src/dapp/rpc/personal.rs',
    'src/dapp/rpc/wallet.rs'
];

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    // Find all async fn declarations and replace them with pub(crate) async fn
    content = content.replace(/^async fn /gm, 'pub(crate) async fn ');
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed visibility for ' + file);
}

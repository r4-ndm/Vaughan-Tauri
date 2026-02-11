# HTTP Proxy Limitations

## What We Tried

HTTP proxy that:
1. Fetches external dApp HTML
2. Strips CSP headers
3. Injects provider script
4. Serves via localhost

## Why It Doesn't Work

### Problem 1: Relative URLs
- Uniswap loads `/assets/index.js`
- Browser requests `http://localhost:8765/assets/index.js`
- Proxy doesn't know to fetch from `https://app.uniswap.org/assets/index.js`

**Solution**: Rewrite ALL URLs in HTML/CSS/JS to be absolute or proxied

### Problem 2: Dynamic Resource Loading
- JavaScript dynamically loads resources
- `fetch('/api/data')` → requests from localhost
- Need to intercept and proxy ALL fetch/XHR requests

**Solution**: Inject service worker or monkey-patch fetch/XHR

### Problem 3: CSP in Meta Tags
- Even if we strip HTTP headers, CSP can be in `<meta>` tags
- Need to parse and remove `<meta http-equiv="Content-Security-Policy">`

**Solution**: Parse HTML and remove CSP meta tags

### Problem 4: Cookies and Sessions
- Cookies set for `app.uniswap.org` won't work on `localhost:8765`
- Session management breaks

**Solution**: Complex cookie proxying

### Problem 5: CORS
- External APIs called by dApp will have CORS issues
- Need to proxy ALL external requests

**Solution**: Proxy everything (becomes a full HTTP proxy)

## Conclusion

**The HTTP proxy approach requires building a full-featured web proxy**, which is:
- Complex to implement correctly
- Hard to maintain
- Has many edge cases
- Security concerns

## Better Alternatives

### 1. WalletConnect (Already Working ✅)
- Industry standard
- Works with ANY dApp
- No proxy needed
- Secure

### 2. Tauri Custom Protocol (Future)
- Serve via `tauri://` protocol
- Full Tauri IPC access
- Proper solution
- Requires more research

### 3. Browser Extension (Different Product)
- Real MetaMask approach
- Full browser integration
- Different architecture

## Recommendation

**Use WalletConnect for now**. It's:
- ✅ Already implemented
- ✅ Works perfectly
- ✅ Industry standard
- ✅ Secure
- ✅ No maintenance burden

The HTTP proxy is a rabbit hole that doesn't lead anywhere good.

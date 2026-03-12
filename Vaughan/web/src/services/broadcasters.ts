// NOTE: This is a forward-looking stub for a future "relayer/broadcaster" feature.
// It is not currently wired into the app, but kept so we can iterate on designs
// without losing this sketch. See README "Code hygiene" for context.

export interface BroadcasterFeeQuote {
    broadcasterUrl: string;
    feePercentage: number;
    tokenAddress: string;
    available: boolean;
}

/**
 * A fallback mechanism to replacing the deprecated Waku Relayer Client.
 * Directly pings known Broadcaster URLs for their fee matrices.
 */
export class BroadcasterApi {
    private knownBroadcasters: string[] = [
        // Typically populated by a hardcoded list of reliable Railgun broadcasters
        // e.g. 'https://relayer.my-privacy-node.com'
    ];

    /**
     * Set the list of known broadcasters that the wallet will poll.
     */
    public setBroadcasters(urls: string[]) {
        this.knownBroadcasters = urls;
    }

    /**
     * Polls all known broadcasters for their fee quote on a specific chain.
     */
    public async getFeeQuotes(chainId: number, tokenAddress: string): Promise<BroadcasterFeeQuote[]> {
        console.log(`[BroadcasterApi] Fetching fee quotes for token ${tokenAddress} on chain ${chainId}`);

        const quotes: BroadcasterFeeQuote[] = [];

        for (const url of this.knownBroadcasters) {
            try {
                // The Railgun API typically exposes /fees
                // We're stubbing the actual fetch for now until we have valid broadcaster URLs
                // const res = await fetch(`${url}/fees`);
                // const data = await res.json();

                // Stub quote
                quotes.push({
                    broadcasterUrl: url,
                    feePercentage: 0.02, // e.g. 2% fee
                    tokenAddress,
                    available: true,
                });
            } catch (err) {
                console.warn(`[BroadcasterApi] Failed to poll broadcaster ${url}:`, err);
                quotes.push({
                    broadcasterUrl: url,
                    feePercentage: 0,
                    tokenAddress,
                    available: false,
                });
            }
        }

        return quotes.filter(q => q.available);
    }
}

export const broadcasterApi = new BroadcasterApi();

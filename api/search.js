// Vercel Edge Function — Proxy for JioMart search API
// Edge runs on Cloudflare's global network (less likely to be blocked)

export const config = {
    runtime: 'edge',
};

export default async function handler(req) {
    // Only allow POST
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const body = await req.json();
        const query = body?.query || '';
        const refererUrl = `https://www.jiomart.com/search?q=${encodeURIComponent(query)}&sort=all_products`;

        const response = await fetch('https://www.jiomart.com/trex/autoSearch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
                'Referer': refererUrl,
                'Origin': 'https://www.jiomart.com',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            console.error(`Upstream ${response.status}:`, errorText.slice(0, 500));
            return new Response(JSON.stringify({ error: `Upstream API returned ${response.status}` }), {
                status: response.status,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const data = await response.text();

        return new Response(data, {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
            },
        });

    } catch (err) {
        console.error('Proxy error:', err);
        return new Response(JSON.stringify({ error: 'Failed to fetch from upstream API' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

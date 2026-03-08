// Vercel Serverless Function — Proxy for JioMart search API
// This avoids CORS issues when calling from the browser

export default async function handler(req, res) {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const query = req.body?.query || '';
        const refererUrl = `https://www.jiomart.com/search?q=${encodeURIComponent(query)}&sort=all_products`;

        const response = await fetch('https://www.jiomart.com/trex/autoSearch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Referer': refererUrl,
                'Origin': 'https://www.jiomart.com',
                'Host': 'www.jiomart.com',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
                'Connection': 'keep-alive',
            },
            body: JSON.stringify(req.body),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            console.error(`Upstream ${response.status}:`, errorText.slice(0, 500));
            return res.status(response.status).json({ error: `Upstream API returned ${response.status}` });
        }

        const data = await response.json();

        // Cache for 5 minutes
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
        return res.status(200).json(data);

    } catch (err) {
        console.error('Proxy error:', err);
        return res.status(500).json({ error: 'Failed to fetch from upstream API' });
    }
}

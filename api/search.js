// Vercel Serverless Function — Proxy for JioMart search API
// This avoids CORS issues when calling from the browser

export default async function handler(req, res) {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const response = await fetch('https://www.jiomart.com/trex/autoSearch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Referer': 'https://www.jiomart.com/',
                'Origin': 'https://www.jiomart.com',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            body: JSON.stringify(req.body),
        });

        if (!response.ok) {
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

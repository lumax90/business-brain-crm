// test-ddg.ts
async function ddgSearch(query: string) {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        }
    });
    console.log("Status:", response.status);
    const html = await response.text();

    const domains = new Set<string>();

    // Look for uddg= parameter in DDG links
    const uddgPattern = /uddg=([^&"']+)/g;
    let match;
    while ((match = uddgPattern.exec(html)) !== null) {
        try {
            const decodedUrl = decodeURIComponent(match[1]);
            const domainMatch = decodedUrl.match(/https?:\/\/(?:www\.)?([^\/]+)/);
            if (domainMatch && domainMatch[1]) {
                const domain = domainMatch[1].toLowerCase();
                domains.add(domain);
            }
        } catch (e) { }
    }
    console.log("Found domains:", Array.from(domains).slice(0, 10));
}
ddgSearch("TTAF Savunma company website").catch(console.error);

import dns from "dns";
import { PrismaClient } from "@prisma/client";
import { OpenAI } from "openai";

const prisma = new PrismaClient();

export interface DomainResult {
    company: string;
    domain: string | null;
    confidence: number; // 0-100
    source: string; // "google", "cached"
    alternatives: string[];
}

// ─── Domains to skip (not company websites) ───
const SKIP_DOMAINS = new Set([
    "google.com", "google.com.tr", "gstatic.com", "googleapis.com",
    "youtube.com", "facebook.com", "twitter.com", "x.com", "instagram.com",
    "linkedin.com", "wikipedia.org", "wikimedia.org",
    "amazon.com", "microsoft.com", "apple.com",
    "glassdoor.com", "indeed.com", "crunchbase.com", "zoominfo.com",
    "bloomberg.com", "reuters.com", "bbc.com", "cnn.com",
    "github.com", "stackoverflow.com", "medium.com",
    "w3.org", "schema.org", "cloudflare.com",
    "tiktok.com", "pinterest.com", "reddit.com",
    "trustpilot.com", "yelp.com", "tripadvisor.com",
    "play.google.com", "apps.apple.com",
    "maps.google.com", "translate.google.com",
]);

// ─── Serper.dev Search (Google Search API) ───
async function serperSearch(query: string, apiKey: string): Promise<string[]> {
    try {
        const response = await fetch("https://google.serper.dev/search", {
            method: "POST",
            headers: {
                "X-API-KEY": apiKey,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                q: query,
                gl: "tr", // Optional: localize searches (remove or make dynamic later)
                num: 10,
            }),
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
            console.warn(`Serper search returned ${response.status} for: ${query}`);
            return [];
        }

        const data = await response.json();
        const domains: string[] = [];
        const seen = new Set<string>();

        if (data.organic && Array.isArray(data.organic)) {
            for (const item of data.organic) {
                if (!item.link) continue;

                try {
                    const domainMatch = item.link.match(/https?:\/\/(?:www\.)?([^\/]+)/);
                    if (domainMatch && domainMatch[1]) {
                        let domain = domainMatch[1].toLowerCase();

                        // Clean trailing chars like / or # from naive regex matching
                        domain = domain.split(/[\/?#]/)[0];

                        // Skip irrelevant domains
                        if (SKIP_DOMAINS.has(domain)) continue;
                        if (domain.length < 4) continue;

                        // Skip subdomains of skip-list entries
                        let isSubOfSkip = false;
                        for (const skip of SKIP_DOMAINS) {
                            if (domain.endsWith(`.${skip}`)) { isSubOfSkip = true; break; }
                        }
                        if (isSubOfSkip) continue;

                        if (!seen.has(domain)) {
                            seen.add(domain);
                            domains.push(domain);
                        }
                    }
                } catch (e) { }
            }
        }

        return domains.slice(0, 10);
    } catch (err) {
        console.error("Serper search error:", err);
        return [];
    }
}

// ─── Check if domain has MX records (can receive email) ───
function hasMxRecords(domain: string): Promise<boolean> {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(false), 3000);
        dns.resolveMx(domain, (err, records) => {
            clearTimeout(timeout);
            if (err || !records || records.length === 0) resolve(false);
            else resolve(true);
        });
    });
}

// ─── DuckDuckGo HTML Search — scrape search results page ───
async function duckDuckGoSearch(query: string): Promise<string[]> {
    try {
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const response = await fetch(url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9,tr;q=0.8",
            },
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
            console.warn(`DuckDuckGo search returned ${response.status} for: ${query}`);
            return [];
        }

        const html = await response.text();

        const domains: string[] = [];
        const seen = new Set<string>();

        // Extract URLs from DuckDuckGo search results (uddg parameter)
        const uddgPattern = /uddg=([^&"']+)/g;
        let match;

        while ((match = uddgPattern.exec(html)) !== null) {
            try {
                const decodedUrl = decodeURIComponent(match[1]);
                const domainMatch = decodedUrl.match(/https?:\/\/(?:www\.)?([^\/]+)/);
                if (domainMatch && domainMatch[1]) {
                    let domain = domainMatch[1].toLowerCase();

                    // Skip irrelevant domains
                    if (SKIP_DOMAINS.has(domain)) continue;
                    if (domain.length < 4) continue;

                    // Skip subdomains of skip-list entries
                    let isSubOfSkip = false;
                    for (const skip of SKIP_DOMAINS) {
                        if (domain.endsWith(`.${skip}`)) { isSubOfSkip = true; break; }
                    }
                    if (isSubOfSkip) continue;

                    if (!seen.has(domain)) {
                        seen.add(domain);
                        domains.push(domain);
                    }
                }
            } catch (e) {
                // Ignore uri decode errors
            }
        }

        return domains.slice(0, 10);
    } catch (err) {
        console.error("DuckDuckGo search error:", err);
        return [];
    }
}

// ─── Score how well a domain matches company name ───
function scoreDomain(domain: string, companyName: string): number {
    const name = companyName.toLowerCase().trim();
    // Use tldjs or roughly just use the main domain part
    // e.g. from "arisavunma.com.tr" -> "arisavunma"
    const domainBase = domain.split(".")[0].toLowerCase();

    // Clean Turkish chars to English for better matching
    const trMap: Record<string, string> = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'i': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u' };
    const normalize = (str: string) => str.replace(/[çğıiöşü]/g, (m) => trMap[m]).replace(/[^a-z0-9]/g, "");

    const nameWords = name.split(/\s+/).map(normalize).filter(Boolean);
    const nameJoined = nameWords.join("");
    const domainNorm = normalize(domainBase);

    // Exact match (e.g. "eva" matches eva.ai)
    if (domainNorm === nameJoined) return 95;

    // First word exact match (e.g. "ttaf" from "TTAF Savunma")
    if (nameWords[0] && domainNorm === nameWords[0] && nameWords[0].length >= 3) return 90;

    // Domain base contains full joined name
    if (domainNorm.includes(nameJoined) && nameJoined.length >= 3) return 85;

    // Joined name contains domain base (domain is abbreviation of company)
    if (nameJoined.includes(domainNorm) && domainNorm.length >= 3) return 80;

    // First two words combined match
    if (nameWords.length >= 2) {
        const twoWords = nameWords[0] + nameWords[1];
        if (domainNorm === twoWords) return 88;
        if (domainNorm.includes(twoWords) && twoWords.length >= 4) return 78;
        if (twoWords.includes(domainNorm) && domainNorm.length >= 4) return 75;
    }

    // First word contains domain base
    if (nameWords[0] && nameWords[0].includes(domainNorm) && domainNorm.length >= 4) return 60;

    // Domain contains first word
    if (nameWords[0] && domainNorm.includes(nameWords[0]) && nameWords[0].length >= 4) return 65;

    // Low match — returned by search provider so it's somewhat relevant
    return 30;
}

// ─── Main: Find domain for a company ───
export async function findCompanyDomain(
    companyName: string,
    location?: string,
    useAiFallback: boolean = false
): Promise<DomainResult> {
    const result: DomainResult = {
        company: companyName,
        domain: null,
        confidence: 0,
        source: "none",
        alternatives: [],
    };

    if (!companyName || companyName.trim().length < 2) return result;

    // Clean the company name for querying (remove trailing dots, etc.)
    const cleanQuery = companyName.trim().replace(/\.+$/, "");

    // ─── Search Queries ───
    // Removed strict quotes "" around company name to allow search engines more flexibility
    // when dealing with suffixes like "Sanayi ve Ticaret A.Ş."
    const searchQueries = [
        `${cleanQuery} official website`,
        location ? `${cleanQuery} ${location} company` : `${cleanQuery} company website`,
    ];

    const allDomains: { domain: string; score: number }[] = [];
    const seenDomains = new Set<string>();

    // Load active provider string and API key from DB
    const settingsList = await prisma.appSetting.findMany({
        where: { key: { in: ["DOMAIN_PROVIDER", "SERPER_API_KEY", "OPENAI_API_KEY", "AI_MODEL"] } }
    });
    const settings = settingsList.reduce((acc: Record<string, string>, curr: { key: string, value: string }) => {
        acc[curr.key] = curr.value;
        return acc;
    }, {});

    const provider = settings["DOMAIN_PROVIDER"] || "duckduckgo";
    const serperKey = settings["SERPER_API_KEY"];

    for (const query of searchQueries) {
        console.log(`  🔍 Searching [${provider}]: ${query}`);
        let domains: string[] = [];

        if (provider === "serper" && serperKey) {
            domains = await serperSearch(query, serperKey);
        } else {
            domains = await duckDuckGoSearch(query);
            if (provider === "serper" && !serperKey) {
                console.warn("  ⚠️ Serper is selected but API key is missing. Falling back to DuckDuckGo.");
            }
        }

        for (const domain of domains) {
            if (seenDomains.has(domain)) continue;
            seenDomains.add(domain);

            const score = scoreDomain(domain, companyName);
            allDomains.push({ domain, score });
        }

        // If first search found high-confidence result, skip second search
        const best = allDomains.sort((a, b) => b.score - a.score)[0];
        if (best && best.score >= 80) break;

        // Small delay between search queries
        if (searchQueries.indexOf(query) < searchQueries.length - 1) {
            await new Promise((r) => setTimeout(r, 500));
        }
    }

    // Sort by score
    allDomains.sort((a, b) => b.score - a.score);

    if (allDomains.length === 0) return result;

    // ─── MX Validation on top candidate ───
    const topDomain = allDomains[0];
    const hasMx = await hasMxRecords(topDomain.domain);
    if (hasMx) topDomain.score = Math.min(topDomain.score + 5, 98);

    // Set result
    result.domain = topDomain.domain;
    result.confidence = Math.min(topDomain.score, 98);
    result.source = "google";
    result.alternatives = allDomains
        .slice(1, 4)
        .map((d) => d.domain)
        .filter((d) => d !== topDomain.domain);

    // ─── AI Fallback ───
    if (result.confidence < 85 && useAiFallback && settings["OPENAI_API_KEY"]) {
        try {
            console.log(`    🤖 High uncertainty (${result.confidence}%). Asking AI to verify domains for ${companyName}...`);
            const openai = new OpenAI({ apiKey: settings["OPENAI_API_KEY"] });
            const model = settings["AI_MODEL"] || "gpt-4o-mini";

            const aiResponse = await openai.chat.completions.create({
                model,
                messages: [
                    {
                        role: "system",
                        content: "You are an expert data researcher. Your job is to identify the CORRECT official website URL for a given company based on a list of potential domains. Output ONLY a JSON object with 'domain' (string) and 'confidence' (number 0-100). If you are uncertain or if none of the domains belong to the company, return null for the domain."
                    },
                    {
                        role: "user",
                        content: `Company Name: ${companyName}\nLocation: ${location || "Unknown"}\n\nPotential Domains:\n${allDomains.slice(0, 10).map((d, i) => `${i + 1}. ${d.domain}`).join("\n")}\n\nWhat is the official website domain?`
                    }
                ],
                response_format: { type: "json_object" },
                temperature: 0.1,
            });

            const content = aiResponse.choices[0].message.content;
            if (content) {
                const aiResult = JSON.parse(content);
                if (aiResult.domain && aiResult.confidence > 80) {
                    // Overwrite result with AI suggestion
                    result.domain = aiResult.domain;
                    result.confidence = 95; // Boost confidence since AI validated it
                    result.source = "openai";
                    console.log(`    🚀 AI successfully found domain: ${result.domain}`);
                } else {
                    console.log(`    🤔 AI could not confidently identify the domain.`);
                }
            }
        } catch (aiErr) {
            console.error(`    ❌ AI Fallback failed for ${companyName}:`, aiErr);
        }
    }

    console.log(`  ✅ Found: ${result.domain} (${result.confidence}% confidence, source: ${result.source})`);

    return result;
}

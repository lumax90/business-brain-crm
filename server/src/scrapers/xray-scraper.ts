import { PlaywrightCrawler } from "crawlee";

export interface ScrapedLead {
    name: string;
    title: string;
    company: string;
    linkedinUrl: string;
    snippet: string;
}

export interface XRaySearchParams {
    jobTitle: string;
    location?: string;
    industry?: string;
    keywords?: string;
    maxResults?: number;
}

function buildXRayQuery(params: XRaySearchParams): string {
    let query = `site:linkedin.com/in`;
    if (params.jobTitle) query += ` "${params.jobTitle}"`;
    if (params.location) query += ` "${params.location}"`;
    if (params.industry) query += ` "${params.industry}"`;
    if (params.keywords) query += ` ${params.keywords}`;
    return query;
}

function parseNameFromTitle(title: string): {
    name: string;
    title: string;
    company: string;
} {
    const cleaned = title
        .replace(/\s*[\|·]\s*LinkedIn\s*$/i, "")
        .replace(/\s*-\s*LinkedIn\s*$/i, "")
        .trim();

    const dashSplit = cleaned.split(/\s*[-–—]\s*/);

    if (dashSplit.length >= 3) {
        return {
            name: dashSplit[0].trim(),
            title: dashSplit[1].trim(),
            company: dashSplit.slice(2).join(" ").trim(),
        };
    }

    if (dashSplit.length === 2) {
        const atMatch = dashSplit[1].match(/^(.+?)\s+at\s+(.+)$/i);
        if (atMatch) {
            return {
                name: dashSplit[0].trim(),
                title: atMatch[1].trim(),
                company: atMatch[2].trim(),
            };
        }
        return {
            name: dashSplit[0].trim(),
            title: dashSplit[1].trim(),
            company: "",
        };
    }

    return { name: cleaned, title: "", company: "" };
}

function extractLinkedInUrl(url: string): string | null {
    const match = url.match(/linkedin\.com\/in\/[a-zA-Z0-9\-_%]+/);
    if (match) {
        return `https://www.${match[0].split("?")[0]}`;
    }
    return null;
}

export async function xraySearch(
    params: XRaySearchParams
): Promise<ScrapedLead[]> {
    const query = buildXRayQuery(params);
    const maxResults = params.maxResults || 20;
    const leads: ScrapedLead[] = [];
    const maxPages = Math.min(Math.ceil(maxResults / 10), 3);

    const urls: string[] = [];
    for (let page = 0; page < maxPages; page++) {
        const start = page * 10;
        urls.push(
            `https://www.google.com/search?q=${encodeURIComponent(query)}&start=${start}&num=10`
        );
    }

    const crawler = new PlaywrightCrawler({
        maxRequestsPerCrawl: maxPages,
        maxConcurrency: 1,
        requestHandlerTimeoutSecs: 45,
        navigationTimeoutSecs: 30,
        headless: true,

        launchContext: {
            launchOptions: {
                args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-blink-features=AutomationControlled",
                ],
            },
        },

        preNavigationHooks: [
            async ({ page }) => {
                // Stealth: override navigator.webdriver
                await page.addInitScript(() => {
                    Object.defineProperty(navigator, "webdriver", {
                        get: () => undefined,
                    });
                });

                // Set realistic viewport
                await page.setViewportSize({ width: 1366, height: 768 });
            },
        ],

        requestHandler: async ({ page, request }) => {
            // Wait for results to load
            await page.waitForSelector("div#search", { timeout: 15000 }).catch(() => { });

            // Small random delay to appear human
            await page.waitForTimeout(1000 + Math.random() * 2000);

            // Extract search results
            const results = await page.evaluate(() => {
                const items: {
                    title: string;
                    url: string;
                    snippet: string;
                }[] = [];

                // Google search result selectors
                const resultElements = document.querySelectorAll("div.g");

                resultElements.forEach((el) => {
                    const linkEl = el.querySelector("a[href*='linkedin.com/in']");
                    const titleEl = el.querySelector("h3");
                    const snippetEl =
                        el.querySelector("div[data-sncf]") ||
                        el.querySelector("div.VwiC3b") ||
                        el.querySelector("span.st");

                    if (linkEl && titleEl) {
                        items.push({
                            title: titleEl.textContent?.trim() || "",
                            url: (linkEl as HTMLAnchorElement).href || "",
                            snippet: snippetEl?.textContent?.trim() || "",
                        });
                    }
                });

                return items;
            });

            for (const result of results) {
                const linkedinUrl = extractLinkedInUrl(result.url);
                if (!linkedinUrl) continue;

                const parsed = parseNameFromTitle(result.title);
                if (!parsed.name || parsed.name.length < 2) continue;
                if (leads.some((l) => l.linkedinUrl === linkedinUrl)) continue;

                leads.push({
                    name: parsed.name,
                    title: parsed.title,
                    company: parsed.company,
                    linkedinUrl,
                    snippet: result.snippet || "",
                });
            }

            // Random delay between pages
            const delay = 3000 + Math.random() * 4000;
            await page.waitForTimeout(delay);
        },

        failedRequestHandler: async ({ request }) => {
            console.error(`Request failed: ${request.url}`);
        },
    });

    await crawler.run(urls);

    return leads.slice(0, maxResults);
}

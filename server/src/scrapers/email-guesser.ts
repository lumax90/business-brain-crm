import dns from "dns";

export interface EmailCandidate {
    email: string;
    pattern: string;
    priority: number;
}

export function guessEmails(
    firstName: string,
    lastName: string,
    domain: string
): EmailCandidate[] {
    const first = firstName.toLowerCase().replace(/[^a-z]/g, "");
    const last = lastName.toLowerCase().replace(/[^a-z]/g, "");
    const fInitial = first.charAt(0);
    const lInitial = last.charAt(0);

    if (!first || !last || !domain) return [];

    const patterns: { pattern: string; email: string }[] = [
        { pattern: "first.last", email: `${first}.${last}@${domain}` },
        { pattern: "first", email: `${first}@${domain}` },
        { pattern: "flast", email: `${fInitial}${last}@${domain}` },
        { pattern: "firstlast", email: `${first}${last}@${domain}` },
        { pattern: "first_last", email: `${first}_${last}@${domain}` },
        { pattern: "f.last", email: `${fInitial}.${last}@${domain}` },
        { pattern: "last.first", email: `${last}.${first}@${domain}` },
        { pattern: "last", email: `${last}@${domain}` },
        { pattern: "firstl", email: `${first}${lInitial}@${domain}` },
        { pattern: "first.l", email: `${first}.${lInitial}@${domain}` },
    ];

    return patterns.map((p, i) => ({
        email: p.email,
        pattern: p.pattern,
        priority: i + 1,
    }));
}

/**
 * Generate a single email candidate from a known pattern + domain
 */
export function generateFromPattern(
    firstName: string,
    lastName: string,
    domain: string,
    pattern: string
): string | null {
    const first = firstName.toLowerCase().replace(/[^a-z]/g, "");
    const last = lastName.toLowerCase().replace(/[^a-z]/g, "");
    const fInitial = first.charAt(0);
    const lInitial = last.charAt(0);

    if (!first || !last || !domain) return null;

    const map: Record<string, string> = {
        "first.last": `${first}.${last}@${domain}`,
        "first": `${first}@${domain}`,
        "flast": `${fInitial}${last}@${domain}`,
        "firstlast": `${first}${last}@${domain}`,
        "first_last": `${first}_${last}@${domain}`,
        "f.last": `${fInitial}.${last}@${domain}`,
        "last.first": `${last}.${first}@${domain}`,
        "last": `${last}@${domain}`,
        "firstl": `${first}${lInitial}@${domain}`,
        "first.l": `${first}.${lInitial}@${domain}`,
    };

    return map[pattern] || null;
}

/**
 * Check if a domain has MX records (can receive email)
 */
function checkMx(domain: string): Promise<boolean> {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(false), 3000);
        dns.resolveMx(domain, (err, records) => {
            clearTimeout(timeout);
            if (err || !records || records.length === 0) resolve(false);
            else resolve(true);
        });
    });
}

/**
 * Smarter company domain guessing — tries multiple TLDs and validates MX records.
 * Used as LAST RESORT when Find Domains didn't find anything and lead has no website.
 */
export async function guessCompanyDomain(companyName: string): Promise<string> {
    if (!companyName) return "";

    const cleaned = companyName
        .toLowerCase()
        .replace(
            /\b(inc\.?|llc\.?|ltd\.?|corp\.?|co\.?|group|solutions|technologies|tech|consulting|agency|studios?|labs?|gmbh|s\.?a\.?|plc|limited|sanayi|ticaret|a\.?ş\.?|şti\.?|anonim|şirketi)\b/gi,
            ""
        )
        .replace(/[^a-z0-9\s]/g, "")
        .trim()
        .replace(/\s+/g, "");

    if (!cleaned) return "";

    // Try multiple TLDs — most common first
    const tlds = [".com", ".com.tr", ".net", ".org", ".io", ".co", ".net.tr", ".org.tr"];

    for (const tld of tlds) {
        const candidate = `${cleaned}${tld}`;
        const hasMx = await checkMx(candidate);
        if (hasMx) {
            console.log(`  📧 guessCompanyDomain: ${companyName} → ${candidate} (MX verified)`);
            return candidate;
        }
    }

    // No MX found for any TLD, return .com as best guess
    console.log(`  📧 guessCompanyDomain: ${companyName} → ${cleaned}.com (no MX found, best guess)`);
    return `${cleaned}.com`;
}

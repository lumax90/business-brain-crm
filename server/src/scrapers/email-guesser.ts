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

export function guessCompanyDomain(companyName: string): string {
    if (!companyName) return "";

    const cleaned = companyName
        .toLowerCase()
        .replace(
            /\b(inc\.?|llc\.?|ltd\.?|corp\.?|co\.?|group|solutions|technologies|tech|consulting|agency|studios?|labs?|gmbh|s\.?a\.?|plc|limited)\b/gi,
            ""
        )
        .replace(/[^a-z0-9\s]/g, "")
        .trim()
        .replace(/\s+/g, "");

    if (!cleaned) return "";
    return `${cleaned}.com`;
}

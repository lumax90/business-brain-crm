import { Router, Request, Response } from "express";
import { guessEmails, guessCompanyDomain, generateFromPattern } from "../scrapers/email-guesser";
import { verifyEmailCandidates } from "../scrapers/email-verifier";
import { findCompanyDomain } from "../scrapers/domain-finder";
import { prisma } from "../lib/prisma";

export const emailRouter = Router();

// ─── POST /api/email/find — Single lead email finder ───
emailRouter.post("/find", async (req: Request, res: Response) => {
    try {
        const { firstName, lastName, company, domain } = req.body;

        if (!firstName || !lastName) {
            res.status(400).json({ error: "firstName and lastName are required" });
            return;
        }

        const emailDomain = domain || await guessCompanyDomain(company || "");

        if (!emailDomain) {
            res.status(400).json({
                error: "Could not determine domain. Provide a domain or company name.",
            });
            return;
        }

        console.log(`📧 Finding email for ${firstName} ${lastName} @ ${emailDomain}`);

        const candidates = guessEmails(firstName, lastName, emailDomain);
        const topEmails = candidates.slice(0, 5).map((c) => c.email);
        const verifications = await verifyEmailCandidates(topEmails);

        const results = candidates.map((candidate) => {
            const verification = verifications.find((v) => v.email === candidate.email);
            return {
                ...candidate,
                status: verification?.result || "unverified",
                message: verification?.message || "Not verified",
            };
        });

        const order: Record<string, number> = {
            valid: 0, catch_all: 1, unknown: 2, unverified: 3, invalid: 4, error: 5,
        };
        results.sort((a, b) => (order[a.status] ?? 99) - (order[b.status] ?? 99));

        const best = results.find((r) => r.status === "valid" || r.status === "catch_all");
        console.log(`✅ Best email: ${best?.email || "none found"} (${best?.status || "n/a"})`);

        res.json({
            success: true,
            domain: emailDomain,
            count: results.length,
            results,
        });
    } catch (error: unknown) {
        console.error("Email finder error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: "Email finding failed", message });
    }
});

// ─── GET /api/email/stats — Email enrichment statistics ───
emailRouter.get("/stats", async (_req: Request, res: Response) => {
    try {
        const [total, withEmail, found, notFound, catchAll, pending, verified] = await Promise.all([
            prisma.lead.count(),
            prisma.lead.count({ where: { email: { not: null } } }),
            prisma.lead.count({ where: { emailStatus: "found" } }),
            prisma.lead.count({ where: { emailStatus: "not_found" } }),
            prisma.lead.count({ where: { emailStatus: "catch_all" } }),
            prisma.lead.count({ where: { emailStatus: "pending" } }),
            prisma.lead.count({ where: { emailVerifiedAt: { not: null } } }),
        ]);

        res.json({
            success: true,
            stats: { total, withEmail, found, notFound, catchAll, pending, verified },
        });
    } catch (error: unknown) {
        console.error("Email stats error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── POST /api/email/enrich — Bulk enrichment via SSE (Apollo/Hunter style) ───
emailRouter.post("/enrich", async (req: Request, res: Response) => {
    try {
        const { leadIds, listId, useAiFallback } = req.body as { leadIds?: string[]; listId?: string; useAiFallback?: boolean };

        // Build query
        const where: any = {};
        if (leadIds && leadIds.length > 0) {
            where.id = { in: leadIds };
        } else if (listId) {
            where.listId = listId;
        }
        // Only process leads that haven't been enriched yet or failed
        where.emailStatus = { in: ["pending", "error", "not_found"] };

        const leads = await prisma.lead.findMany({
            where,
            select: { id: true, name: true, company: true, website: true, email: true, customFields: true },
            take: 5000,
        });

        if (leads.length === 0) {
            res.json({ success: true, message: "No leads to enrich", processed: 0, found: 0 });
            return;
        }

        // Set up SSE
        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        });

        const sendEvent = (data: any) => {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        sendEvent({ type: "start", total: leads.length });

        let processed = 0;
        let found = 0;
        let notFoundCount = 0;
        let catchAllCount = 0;
        let errorCount = 0;

        // Fetch Verification Provider Settings once for the batch
        const settingsList = await prisma.appSetting.findMany({
            where: { key: { in: ["EMAIL_VERIFICATION_PROVIDER", "HUNTER_API_KEY", "ZEROBOUNCE_API_KEY", "OPENAI_API_KEY", "AI_MODEL", "SMTP_VERIFIER_URL", "SMTP_VERIFIER_API_KEY"] } }
        });
        const settings = settingsList.reduce((acc: Record<string, string>, curr) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {});

        const verificationProvider = settings["EMAIL_VERIFICATION_PROVIDER"] || "local";
        const verificationApiKey = verificationProvider === "hunter" ? settings["HUNTER_API_KEY"] :
            verificationProvider === "zerobounce" ? settings["ZEROBOUNCE_API_KEY"] : undefined;
        const remoteUrl = settings["SMTP_VERIFIER_URL"] || "";
        const remoteApiKey = settings["SMTP_VERIFIER_API_KEY"] || "";

        // ─── PATTERN LEARNING CACHE ───
        // Key: domain → Value: winning email pattern (e.g. "first.last", "flast")
        const domainPatternCache = new Map<string, string>();

        // Pre-load any known patterns from previously enriched leads in the same batch
        const companies = [...new Set(leads.map(l => l.company).filter(Boolean))];
        if (companies.length > 0) {
            const existingPatterns = await prisma.lead.findMany({
                where: {
                    company: { in: companies as string[] },
                    emailStatus: "found",
                    emailPattern: { not: null },
                    website: { not: null },
                },
                select: { website: true, emailPattern: true },
                take: 500,
            });
            for (const ep of existingPatterns) {
                if (ep.website && ep.emailPattern) {
                    const dom = ep.website.replace(/^www\./, "").toLowerCase();
                    if (!domainPatternCache.has(dom)) {
                        domainPatternCache.set(dom, ep.emailPattern);
                    }
                }
            }
            if (domainPatternCache.size > 0) {
                console.log(`📚 Pre-loaded ${domainPatternCache.size} domain patterns from existing data`);
            }
        }

        for (const lead of leads) {
            try {
                // Skip if already has a verified email
                if (lead.email && lead.email.includes("@")) {
                    await prisma.lead.update({
                        where: { id: lead.id },
                        data: { emailStatus: "found" },
                    });
                    found++;
                    processed++;
                    sendEvent({
                        type: "progress", processed, found, total: leads.length,
                        lead: { id: lead.id, name: lead.name, email: lead.email, status: "found" },
                    });
                    continue;
                }

                // Parse name into first + last
                const fullName = lead.name || "";
                let customFields: Record<string, any> = {};
                try { customFields = typeof lead.customFields === "string" ? JSON.parse(lead.customFields as string) : (lead.customFields || {}); } catch { }

                const lastName = customFields["Last Name"] || "";
                const nameParts = fullName.trim().split(/\s+/);
                const firstName = nameParts[0] || "";
                const lastNameFinal = lastName || (nameParts.length > 1 ? nameParts.slice(1).join(" ") : "");

                if (!firstName || !lastNameFinal) {
                    await prisma.lead.update({
                        where: { id: lead.id },
                        data: { emailStatus: "error" },
                    });
                    errorCount++;
                    processed++;
                    sendEvent({
                        type: "progress", processed, found, total: leads.length,
                        lead: { id: lead.id, name: lead.name, email: null, status: "error", reason: "No name" },
                    });
                    continue;
                }

                // ─── DOMAIN RESOLUTION (Apollo/Hunter style priority) ───
                let domain = "";

                // Priority 1: Use lead.website (found by "Find Domains" step)
                if (lead.website) {
                    try {
                        const url = lead.website.startsWith("http") ? lead.website : `https://${lead.website}`;
                        domain = new URL(url).hostname.replace(/^www\./, "");
                    } catch {
                        // website field might just be a raw domain
                        domain = lead.website.replace(/^www\./, "").split("/")[0];
                    }
                }

                // Priority 2: Check if another lead at same company already has a domain
                if (!domain && lead.company) {
                    const cachedLead = await prisma.lead.findFirst({
                        where: {
                            company: { equals: lead.company },
                            website: { not: null },
                        },
                        select: { website: true },
                    });
                    if (cachedLead?.website) {
                        domain = cachedLead.website.replace(/^www\./, "").split("/")[0];
                        // Also save it back to this lead
                        await prisma.lead.update({
                            where: { id: lead.id },
                            data: { website: cachedLead.website },
                        });
                    }
                }

                // Priority 3: Auto-discover domain using findCompanyDomain()
                if (!domain && lead.company) {
                    console.log(`  🔍 Auto-discovering domain for: ${lead.company}`);
                    sendEvent({
                        type: "progress", processed, found, total: leads.length,
                        lead: { id: lead.id, name: lead.name, email: null, status: "searching", reason: `Finding domain for ${lead.company}...` },
                    });

                    try {
                        const domainResult = await findCompanyDomain(lead.company, "", useAiFallback || false);
                        if (domainResult.domain && domainResult.confidence >= 60) {
                            domain = domainResult.domain;
                            // Save discovered domain to ALL leads with this company
                            await prisma.lead.updateMany({
                                where: { company: { equals: lead.company } },
                                data: { website: domain },
                            });
                            console.log(`  ✅ Auto-discovered: ${lead.company} → ${domain}`);
                        }
                    } catch (domErr) {
                        console.error(`  ❌ Domain discovery failed for ${lead.company}:`, domErr);
                    }
                }

                // Priority 4: Last resort — smart domain guessing with MX validation
                if (!domain && lead.company) {
                    domain = await guessCompanyDomain(lead.company);
                }

                if (!domain) {
                    await prisma.lead.update({
                        where: { id: lead.id },
                        data: { emailStatus: "not_found" },
                    });
                    notFoundCount++;
                    processed++;
                    sendEvent({
                        type: "progress", processed, found, total: leads.length,
                        lead: { id: lead.id, name: lead.name, email: null, status: "not_found", reason: "No domain" },
                    });
                    continue;
                }

                // ─── PATTERN LEARNING: Check if we already know this domain's pattern ───
                const domainKey = domain.toLowerCase();
                const knownPattern = domainPatternCache.get(domainKey);

                let topEmails: string[] = [];
                let candidates: ReturnType<typeof guessEmails> = [];

                if (knownPattern) {
                    // We already know the pattern — generate only that one + verify
                    const email = generateFromPattern(firstName, lastNameFinal, domain, knownPattern);
                    if (email) {
                        topEmails = [email];
                        candidates = [{ email, pattern: knownPattern, priority: 1 }];
                        console.log(`  🎯 Using known pattern "${knownPattern}" for ${domain}: ${email}`);
                    }
                }

                // If no known pattern (or generateFromPattern failed), use full candidate list
                if (topEmails.length === 0) {
                    if (useAiFallback) {
                        candidates = guessEmails(firstName, lastNameFinal, domain);
                        try {
                            console.log(`    🤖 Asking AI to guess email format for ${lead.name} at ${domain}...`);
                            if (settings["OPENAI_API_KEY"]) {
                                const { OpenAI } = require("openai");
                                const openai = new OpenAI({ apiKey: settings["OPENAI_API_KEY"] });
                                const model = settings["AI_MODEL"] || "gpt-4o-mini";

                                const aiResponse = await openai.chat.completions.create({
                                    model,
                                    messages: [
                                        {
                                            role: "system",
                                            content: "You are an expert data researcher. Your job is to identify the MOST LIKELY email address format for a person at a given company. Return ONLY a JSON object with 'email' (string). If you cannot guess confidently, return null."
                                        },
                                        {
                                            role: "user",
                                            content: `Person Name: ${fullName}\nCompany Domain: ${domain}\n\nWhat is the most likely email address?`
                                        }
                                    ],
                                    response_format: { type: "json_object" },
                                    temperature: 0.1,
                                });

                                const content = aiResponse.choices[0].message.content;
                                if (content) {
                                    const aiResult = JSON.parse(content);
                                    if (aiResult.email && aiResult.email.endsWith(`@${domain}`)) {
                                        topEmails = [aiResult.email.toLowerCase()];
                                        console.log(`    🚀 AI guessed email: ${topEmails[0]}`);
                                        if (!candidates.find(c => c.email === topEmails[0])) {
                                            candidates.unshift({ email: topEmails[0], pattern: "ai_guess", priority: 0 });
                                        }
                                    }
                                }
                            }
                        } catch (aiErr) {
                            console.error(`    ❌ AI Fallback failed for ${lead.name}:`, aiErr);
                        }
                    }

                    // Standard pattern guessing
                    if (topEmails.length === 0) {
                        candidates = guessEmails(firstName, lastNameFinal, domain);
                        topEmails = candidates.slice(0, 5).map((c) => c.email);
                    }
                }

                const verifications = await verifyEmailCandidates(topEmails, verificationProvider, verificationApiKey, remoteUrl, remoteApiKey);

                // Find best result
                const validResult = verifications.find((v) => v.result === "valid");
                const catchAllResult = verifications.find((v) => v.result === "catch_all");
                const errorResult = verifications.find((v) => v.result === "error");

                const bestCandidate = candidates.find((c) => c.email === validResult?.email);
                const catchAllCandidate = candidates.find((c) => c.email === catchAllResult?.email);
                const errorCandidate = candidates.find((c) => c.email === errorResult?.email);

                if (validResult && bestCandidate) {
                    await prisma.lead.update({
                        where: { id: lead.id },
                        data: {
                            email: validResult.email,
                            emailStatus: "found",
                            emailPattern: bestCandidate.pattern,
                            emailVerifiedAt: new Date(),
                        },
                    });
                    found++;

                    // ─── LEARN PATTERN for this domain ───
                    if (!domainPatternCache.has(domainKey) && bestCandidate.pattern !== "ai_guess") {
                        domainPatternCache.set(domainKey, bestCandidate.pattern);
                        console.log(`  📚 Learned pattern for ${domainKey}: ${bestCandidate.pattern}`);
                    }

                    sendEvent({
                        type: "progress", processed: processed + 1, found, total: leads.length,
                        lead: { id: lead.id, name: lead.name, email: validResult.email, status: "found", pattern: bestCandidate.pattern },
                    });
                } else if (catchAllResult && catchAllCandidate) {
                    await prisma.lead.update({
                        where: { id: lead.id },
                        data: {
                            email: catchAllResult.email,
                            emailStatus: "catch_all",
                            emailPattern: catchAllCandidate.pattern,
                            emailVerifiedAt: new Date(),
                        },
                    });
                    catchAllCount++;

                    // Learn pattern for catch-all too (first.last is safest)
                    if (!domainPatternCache.has(domainKey)) {
                        domainPatternCache.set(domainKey, catchAllCandidate.pattern);
                    }

                    sendEvent({
                        type: "progress", processed: processed + 1, found, total: leads.length,
                        lead: { id: lead.id, name: lead.name, email: catchAllResult.email, status: "catch_all", pattern: catchAllCandidate.pattern },
                    });
                } else if (errorResult && errorCandidate) {
                    await prisma.lead.update({
                        where: { id: lead.id },
                        data: {
                            email: errorResult.email,
                            emailStatus: "error",
                            emailPattern: errorCandidate.pattern,
                        },
                    });
                    errorCount++;
                    sendEvent({
                        type: "progress", processed: processed + 1, found, total: leads.length,
                        lead: { id: lead.id, name: lead.name, email: errorResult.email, status: "error", pattern: errorCandidate.pattern },
                    });
                } else {
                    await prisma.lead.update({
                        where: { id: lead.id },
                        data: { emailStatus: "not_found" },
                    });
                    notFoundCount++;
                    sendEvent({
                        type: "progress", processed: processed + 1, found, total: leads.length,
                        lead: { id: lead.id, name: lead.name, email: null, status: "not_found" },
                    });
                }

                processed++;

                // Delay between leads to avoid SMTP blacklisting
                // Shorter delay if we used a known pattern (less SMTP probing)
                await new Promise((r) => setTimeout(r, knownPattern ? 300 : 1000));
            } catch (err) {
                console.error(`Error enriching lead ${lead.id}:`, err);
                await prisma.lead.update({
                    where: { id: lead.id },
                    data: { emailStatus: "error" },
                }).catch(() => { });
                errorCount++;
                processed++;
                sendEvent({
                    type: "progress", processed, found, total: leads.length,
                    lead: { id: lead.id, name: lead.name, email: null, status: "error" },
                });
            }
        }

        sendEvent({ type: "complete", processed, found, notFound: notFoundCount, catchAll: catchAllCount, errors: errorCount });
        res.end();
    } catch (error: unknown) {
        console.error("Enrichment error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── POST /api/email/verify-leads — Re-verify emails ───
emailRouter.post("/verify-leads", async (req: Request, res: Response) => {
    try {
        const { leadIds } = req.body as { leadIds: string[] };
        if (!leadIds || !Array.isArray(leadIds)) {
            res.status(400).json({ error: "leadIds array required" });
            return;
        }

        const leads = await prisma.lead.findMany({
            where: { id: { in: leadIds }, email: { not: null } },
            select: { id: true, email: true },
        });

        // Set up SSE
        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        });

        const sendEvent = (data: any) => {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        sendEvent({ type: "start", total: leads.length });

        let processed = 0;
        let valid = 0;

        // Fetch Verification Provider Settings once for the batch
        const settingsList = await prisma.appSetting.findMany({
            where: { key: { in: ["EMAIL_VERIFICATION_PROVIDER", "HUNTER_API_KEY", "ZEROBOUNCE_API_KEY", "SMTP_VERIFIER_URL", "SMTP_VERIFIER_API_KEY"] } }
        });
        const settings = settingsList.reduce((acc: Record<string, string>, curr) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {});

        const verificationProvider = settings["EMAIL_VERIFICATION_PROVIDER"] || "local";
        const verificationApiKey = verificationProvider === "hunter" ? settings["HUNTER_API_KEY"] :
            verificationProvider === "zerobounce" ? settings["ZEROBOUNCE_API_KEY"] : undefined;
        const remoteUrl = settings["SMTP_VERIFIER_URL"] || "";
        const remoteApiKey = settings["SMTP_VERIFIER_API_KEY"] || "";

        for (const lead of leads) {
            if (!lead.email) { processed++; continue; }

            const verifications = await verifyEmailCandidates([lead.email], verificationProvider, verificationApiKey, remoteUrl, remoteApiKey);
            const result = verifications[0];

            let emailStatus = "not_found";
            if (result?.result === "valid") { emailStatus = "found"; valid++; }
            else if (result?.result === "catch_all") { emailStatus = "catch_all"; }
            else if (result?.result === "error") { emailStatus = "error"; }

            await prisma.lead.update({
                where: { id: lead.id },
                data: { emailStatus, emailVerifiedAt: new Date() },
            });

            processed++;
            sendEvent({
                type: "progress", processed, valid, total: leads.length,
                lead: { id: lead.id, email: lead.email, status: emailStatus },
            });

            await new Promise((r) => setTimeout(r, 500));
        }

        sendEvent({ type: "complete", processed, valid });
        res.end();
    } catch (error: unknown) {
        console.error("Verify error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── POST /api/email/find-domains — Bulk domain discovery via SSE ───
emailRouter.post("/find-domains", async (req: Request, res: Response) => {
    try {
        const { leadIds, listId, forceRerun, useAiFallback } = req.body as { leadIds?: string[]; listId?: string; forceRerun?: boolean; useAiFallback?: boolean };

        // Build query
        const where: any = {};
        if (leadIds && leadIds.length > 0) {
            where.id = { in: leadIds };
        } else if (listId) {
            where.listId = listId;
        }

        const leads = await prisma.lead.findMany({
            where,
            select: { id: true, company: true, website: true, location: true },
        });

        if (leads.length === 0) {
            res.json({ success: true, message: "No leads to process", processed: 0 });
            return;
        }

        // Group by unique company — only process companies without a website
        const companyMap = new Map<string, { company: string; location: string; leadIds: string[]; hasWebsite: boolean }>();
        for (const lead of leads) {
            if (!lead.company) continue;
            const key = lead.company.toLowerCase().trim();
            if (!companyMap.has(key)) {
                companyMap.set(key, {
                    company: lead.company,
                    location: lead.location || "",
                    leadIds: [],
                    hasWebsite: !!lead.website,
                });
            }
            companyMap.get(key)!.leadIds.push(lead.id);
            if (lead.website) companyMap.get(key)!.hasWebsite = true;
        }

        const companies = Array.from(companyMap.values()).filter((c) => forceRerun || !c.hasWebsite);

        if (companies.length === 0) {
            res.json({ success: true, message: "All companies already have domains", processed: 0 });
            return;
        }

        // Set up SSE
        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        });

        const sendEvent = (data: any) => {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        sendEvent({ type: "start", totalCompanies: companies.length, totalLeads: leads.length });

        let processed = 0;
        let found = 0;
        const reviewItems: any[] = [];

        for (const entry of companies) {
            try {
                // ─── Cache check: see if any lead with this company already has a website ───
                if (!forceRerun) {
                    const cached = await prisma.lead.findFirst({
                        where: {
                            company: { equals: entry.company },
                            website: { not: null },
                        },
                        select: { website: true },
                    });

                    if (cached?.website) {
                        // Use cached domain — apply to all leads in this group
                        await prisma.lead.updateMany({
                            where: { id: { in: entry.leadIds } },
                            data: { website: cached.website },
                        });
                        found++;
                        processed++;
                        sendEvent({
                            type: "progress",
                            processed,
                            found,
                            total: companies.length,
                            result: {
                                company: entry.company,
                                domain: cached.website,
                                confidence: 99,
                                source: "cached",
                                alternatives: [],
                                leadCount: entry.leadIds.length,
                                autoSaved: true,
                            },
                        });
                        continue; // No delay needed for cached results
                    }
                }

                console.log(`🔍 Finding domain for: ${entry.company}`);
                const result = await findCompanyDomain(entry.company, entry.location, useAiFallback);

                if (result.domain && result.confidence >= 70) {
                    // High confidence → auto-save
                    await prisma.lead.updateMany({
                        where: { id: { in: entry.leadIds } },
                        data: { website: result.domain },
                    });
                    found++;
                    sendEvent({
                        type: "progress",
                        processed: processed + 1,
                        found,
                        total: companies.length,
                        result: {
                            company: entry.company,
                            domain: result.domain,
                            confidence: result.confidence,
                            source: result.source,
                            alternatives: result.alternatives,
                            leadCount: entry.leadIds.length,
                            autoSaved: true,
                        },
                    });
                } else {
                    // Low confidence → needs review
                    reviewItems.push({
                        company: entry.company,
                        domain: result.domain,
                        confidence: result.confidence,
                        source: result.source,
                        alternatives: result.alternatives,
                        leadIds: entry.leadIds,
                        leadCount: entry.leadIds.length,
                    });
                    sendEvent({
                        type: "progress",
                        processed: processed + 1,
                        found,
                        total: companies.length,
                        result: {
                            company: entry.company,
                            domain: result.domain,
                            confidence: result.confidence,
                            source: result.source,
                            alternatives: result.alternatives,
                            leadCount: entry.leadIds.length,
                            autoSaved: false,
                        },
                    });
                }

                processed++;

                // Delay between Google searches (shorter since no DNS probing)
                await new Promise((r) => setTimeout(r, 1000));
            } catch (err) {
                console.error(`Error finding domain for ${entry.company}:`, err);
                processed++;
                sendEvent({
                    type: "progress",
                    processed,
                    found,
                    total: companies.length,
                    result: {
                        company: entry.company,
                        domain: null,
                        confidence: 0,
                        source: "error",
                        alternatives: [],
                        leadCount: entry.leadIds.length,
                        autoSaved: false,
                    },
                });
            }
        }

        sendEvent({
            type: "complete",
            processed,
            found,
            needsReview: reviewItems.length,
            reviewItems,
        });
        res.end();
    } catch (error: unknown) {
        console.error("Find domains error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── POST /api/email/set-domain — Manually set domain for a company ───
emailRouter.post("/set-domain", async (req: Request, res: Response) => {
    try {
        const { company, domain } = req.body as { company: string; domain: string };
        if (!company || !domain) {
            res.status(400).json({ error: "company and domain are required" });
            return;
        }

        // Find all leads with this company name and update their website
        const result = await prisma.lead.updateMany({
            where: { company: { equals: company } },
            data: { website: domain },
        });

        console.log(`✅ Set domain ${domain} for "${company}" → ${result.count} leads updated`);

        res.json({ success: true, updated: result.count });
    } catch (error: unknown) {
        console.error("Set domain error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

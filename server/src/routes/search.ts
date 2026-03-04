import { Router, Request, Response } from "express";
import { xraySearch } from "../scrapers/xray-scraper";

export const searchRouter = Router();

searchRouter.post("/xray", async (req: Request, res: Response) => {
    try {
        const { jobTitle, location, industry, keywords, maxResults } = req.body;

        if (!jobTitle) {
            res.status(400).json({ error: "jobTitle is required" });
            return;
        }

        console.log(`🔍 X-Ray search: "${jobTitle}" ${location || ""} ${industry || ""}`);

        const leads = await xraySearch({
            jobTitle,
            location: location || undefined,
            industry: industry || undefined,
            keywords: keywords || undefined,
            maxResults: maxResults || 20,
        });

        console.log(`✅ Found ${leads.length} leads`);

        res.json({
            success: true,
            query: { jobTitle, location, industry, keywords },
            count: leads.length,
            leads,
        });
    } catch (error: unknown) {
        console.error("X-Ray search error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: "Search failed", message });
    }
});

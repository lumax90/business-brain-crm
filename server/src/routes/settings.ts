import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
export const settingsRouter = Router();

// ─── GET /api/settings — Retrieve all settings ───
settingsRouter.get("/", async (req: Request, res: Response) => {
    try {
        const settingsList = await prisma.appSetting.findMany();
        const settings = settingsList.reduce((acc: Record<string, string>, curr: { key: string, value: string }) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {});

        res.json({ success: true, settings });
    } catch (error) {
        console.error("Fetch settings error:", error);
        res.status(500).json({ error: "Failed to fetch settings" });
    }
});

// ─── POST /api/settings — Update multiple settings ───
settingsRouter.post("/", async (req: Request, res: Response) => {
    try {
        const updates = req.body as Record<string, string>;

        if (!updates || typeof updates !== "object") {
            res.status(400).json({ error: "Invalid updates payload format" });
            return;
        }

        const transactions = [];

        for (const [key, value] of Object.entries(updates)) {
            transactions.push(
                prisma.appSetting.upsert({
                    where: { key },
                    update: { value },
                    create: { key, value }
                })
            );
        }

        await prisma.$transaction(transactions);

        res.json({ success: true, message: "Settings updated successfully" });
    } catch (error) {
        console.error("Update settings error:", error);
        res.status(500).json({ error: "Failed to update settings" });
    }
});

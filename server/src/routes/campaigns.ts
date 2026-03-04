import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { tenantFilter, tenantData } from "../lib/auth-middleware";
import { createNotification } from "./notifications";

export const campaignsRouter = Router();

// ─── GET /api/campaigns — All campaigns with step count ───
campaignsRouter.get("/", async (req: Request, res: Response) => {
    try {
        const campaigns = await prisma.campaign.findMany({
            where: { ...tenantFilter(req) },
            orderBy: { createdAt: "desc" },
            include: { _count: { select: { steps: true } } },
        });
        res.json({ success: true, campaigns });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── GET /api/campaigns/:id — Single campaign with steps ───
campaignsRouter.get("/:id", async (req: Request, res: Response) => {
    try {
        const campaign = await prisma.campaign.findFirst({
            where: { id: req.params.id as string, ...tenantFilter(req) },
            include: { steps: { orderBy: { stepOrder: "asc" } } },
        });
        if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
        res.json({ success: true, campaign });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── POST /api/campaigns — Create campaign ───
campaignsRouter.post("/", async (req: Request, res: Response) => {
    try {
        const { name, description, type, audienceType } = req.body;
        if (!name) { res.status(400).json({ error: "name is required" }); return; }

        const campaign = await prisma.campaign.create({
            data: {
                name,
                description: description || null,
                type: type || "email",
                audienceType: audienceType || "all",
                ...tenantData(req),
            },
            include: { _count: { select: { steps: true } } },
        });
        res.json({ success: true, campaign });

        createNotification(req.userId!, req.organizationId || null, {
          type: "success",
          title: "Campaign created",
          message: `Campaign "${campaign.name}" created.`,
          href: "/campaigns",
          entity: "campaign",
          entityId: campaign.id,
        }).catch(() => {});
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── PUT /api/campaigns/:id — Update campaign ───
campaignsRouter.put("/:id", async (req: Request, res: Response) => {
    try {
        const data: any = {};
        const fields = ["name", "description", "status", "type", "audienceType"];
        for (const f of fields) { if (req.body[f] !== undefined) data[f] = req.body[f]; }
        const intFields = ["totalRecipients", "sentCount", "openCount", "replyCount"];
        for (const f of intFields) { if (req.body[f] !== undefined) data[f] = parseInt(req.body[f]) || 0; }

        const existingCampaign = await prisma.campaign.findFirst({ where: { id: req.params.id as string, ...tenantFilter(req) } });
        if (!existingCampaign) { res.status(404).json({ error: "Campaign not found" }); return; }

        const campaign = await prisma.campaign.update({
            where: { id: existingCampaign.id },
            data,
            include: { _count: { select: { steps: true } } },
        });
        res.json({ success: true, campaign });

        if (data.status) {
          createNotification(req.userId!, req.organizationId || null, {
            type: "info",
            title: "Campaign status updated",
            message: `Campaign "${campaign.name}" status changed to ${campaign.status}.`,
            href: "/campaigns",
            entity: "campaign",
            entityId: campaign.id,
          }).catch(() => {});
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── DELETE /api/campaigns/:id ───
campaignsRouter.delete("/:id", async (req: Request, res: Response) => {
    try {
        // Delete steps first, then the campaign
        await prisma.campaignStep.deleteMany({ where: { campaignId: req.params.id as string } });
        await prisma.campaign.deleteMany({ where: { id: req.params.id as string, ...tenantFilter(req) } });
        res.json({ success: true });

        createNotification(req.userId!, req.organizationId || null, {
          type: "info",
          title: "Campaign deleted",
          message: `Campaign has been deleted.`,
          href: "/campaigns",
          entity: "campaign",
        }).catch(() => {});
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── POST /api/campaigns/:id/steps — Add step ───
campaignsRouter.post("/:id/steps", async (req: Request, res: Response) => {
    try {
        const { type, subject, body, delayDays } = req.body;

        // Verify campaign belongs to tenant
        const campaign = await prisma.campaign.findFirst({ where: { id: req.params.id as string, ...tenantFilter(req) } });
        if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }

        // compute next order
        const maxStep = await prisma.campaignStep.findFirst({
            where: { campaignId: campaign.id },
            orderBy: { stepOrder: "desc" },
        });
        const nextOrder = (maxStep?.stepOrder || 0) + 1;

        const step = await prisma.campaignStep.create({
            data: {
                campaignId: campaign.id,
                stepOrder: nextOrder,
                type: type || "email",
                subject: subject || null,
                body: body || null,
                delayDays: parseInt(delayDays) || 0,
                ...tenantData(req),
            },
        });
        res.json({ success: true, step });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── PUT /api/campaigns/:campaignId/steps/:stepId — Update step ───
campaignsRouter.put("/:campaignId/steps/:stepId", async (req: Request, res: Response) => {
    try {
        const data: any = {};
        const fields = ["type", "subject", "body"];
        for (const f of fields) { if (req.body[f] !== undefined) data[f] = req.body[f]; }
        if (req.body.delayDays !== undefined) data.delayDays = parseInt(req.body.delayDays) || 0;
        if (req.body.stepOrder !== undefined) data.stepOrder = parseInt(req.body.stepOrder) || 0;

        const existingStep = await prisma.campaignStep.findFirst({ where: { id: req.params.stepId as string, ...tenantFilter(req) } });
        if (!existingStep) { res.status(404).json({ error: "Step not found" }); return; }

        const step = await prisma.campaignStep.update({
            where: { id: existingStep.id },
            data,
        });
        res.json({ success: true, step });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

// ─── DELETE /api/campaigns/:campaignId/steps/:stepId ───
campaignsRouter.delete("/:campaignId/steps/:stepId", async (req: Request, res: Response) => {
    try {
        await prisma.campaignStep.deleteMany({ where: { id: req.params.stepId as string, ...tenantFilter(req) } });
        res.json({ success: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

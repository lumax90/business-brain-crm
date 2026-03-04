import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { tenantFilter, tenantData } from "../lib/auth-middleware";

export const notificationsRouter = Router();

// Helper to create a notification (used by other routes too)
export async function createNotification(
  userId: string,
  organizationId: string | null,
  data: {
    type?: string;
    title: string;
    message: string;
    href?: string;
    entity?: string;
    entityId?: string;
  }
) {
  return prisma.notification.create({
    data: {
      userId,
      organizationId: organizationId || undefined,
      type: data.type || "info",
      title: data.title,
      message: data.message,
      href: data.href || undefined,
      entity: data.entity || undefined,
      entityId: data.entityId || undefined,
    },
  });
}

// ─── GET /api/notifications — List notifications ───
notificationsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const { unread, limit = "30" } = req.query as Record<string, string>;
    const where: any = { ...tenantFilter(req) };
    if (unread === "true") where.read = false;

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: parseInt(limit),
    });

    const unreadCount = await prisma.notification.count({
      where: { ...tenantFilter(req), read: false },
    });

    res.json({ success: true, notifications, unreadCount });
  } catch (error: unknown) {
    console.error("List notifications error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// ─── PATCH /api/notifications/:id/read — Mark one as read ───
notificationsRouter.patch("/:id/read", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.notification.updateMany({
      where: { id, ...tenantFilter(req) },
      data: { read: true },
    });
    res.json({ success: true });
  } catch (error: unknown) {
    console.error("Mark notification read error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// ─── PATCH /api/notifications/read-all — Mark all as read ───
notificationsRouter.patch("/read-all", async (req: Request, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { ...tenantFilter(req), read: false },
      data: { read: true },
    });
    res.json({ success: true });
  } catch (error: unknown) {
    console.error("Mark all read error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// ─── DELETE /api/notifications/:id — Dismiss one ───
notificationsRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.notification.deleteMany({
      where: { id, ...tenantFilter(req) },
    });
    res.json({ success: true });
  } catch (error: unknown) {
    console.error("Delete notification error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// ─── DELETE /api/notifications — Clear all ───
notificationsRouter.delete("/", async (req: Request, res: Response) => {
  try {
    await prisma.notification.deleteMany({
      where: { ...tenantFilter(req) },
    });
    res.json({ success: true });
  } catch (error: unknown) {
    console.error("Clear notifications error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

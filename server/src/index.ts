import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import { requireAuth } from "./lib/auth-middleware";
import { searchRouter } from "./routes/search";
import { emailRouter } from "./routes/email";
import { leadsRouter } from "./routes/leads";
import { listsRouter } from "./routes/lists";
import { settingsRouter } from "./routes/settings";
import { dealsRouter } from "./routes/deals";
import { invoicesRouter } from "./routes/invoices";
import { expensesRouter } from "./routes/expenses";
import { companiesRouter } from "./routes/companies";
import { contactsRouter } from "./routes/contacts";
import { projectsRouter } from "./routes/projects";
import { proposalsRouter } from "./routes/proposals";
import { campaignsRouter } from "./routes/campaigns";
import { recurringRouter } from "./routes/recurring";
import { filesRouter } from "./routes/files";
import { globalSearchRouter } from "./routes/global-search";
import { notificationsRouter } from "./routes/notifications";

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

app.use(cors({ origin: FRONTEND_URL, credentials: true }));

// Better Auth — must be BEFORE express.json() to get raw body
app.all("/api/auth/*", toNodeHandler(auth));

app.use(express.json({ limit: "50mb" }));

// Health check
app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "pixl-sales-brain-scraper" });
});

// Auth middleware for all API routes below
app.use("/api", requireAuth);

// Routes
app.use("/api/search", searchRouter);
app.use("/api/email", emailRouter);
app.use("/api/leads", leadsRouter);
app.use("/api/lists", listsRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/deals", dealsRouter);
app.use("/api/invoices", invoicesRouter);
app.use("/api/expenses", expensesRouter);
app.use("/api/companies", companiesRouter);
app.use("/api/contacts", contactsRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/proposals", proposalsRouter);
app.use("/api/campaigns", campaignsRouter);
app.use("/api/recurring", recurringRouter);
app.use("/api/files", filesRouter);
app.use("/api/global-search", globalSearchRouter);
app.use("/api/notifications", notificationsRouter);

app.listen(PORT, () => {
    console.log(`🧠 Pixl Sales Brain Scraper running on http://localhost:${PORT}`);
});

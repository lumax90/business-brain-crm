import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization } from "better-auth/plugins";
import { prisma } from "./prisma";

export const auth = betterAuth({
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3001",

    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),

    emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
    },

    session: {
        cookieCache: {
            enabled: true,
            maxAge: 60 * 5, // 5 minutes
        },
    },

    trustedOrigins: [process.env.FRONTEND_URL || "http://localhost:3000"],

    plugins: [
        organization({
            allowUserToCreateOrganization: true,
            organizationLimit: 5,
            membershipLimit: 10,
            creatorRole: "owner",
            invitationExpiresIn: 60 * 60 * 48, // 48 hours
            organizationHooks: {
                afterDeleteOrganization: async ({ organization }) => {
                    const orgId = organization.id;
                    // Start a transaction to delete all records associated with this organization
                    // Note: In Prisma, if we use `deleteMany`, it's not strictly necessary to put it in a $transaction since they're independent table operations,
                    // but it's good practice. Actually, we can just run them sequentially or via Promise.all
                    try {
                        console.log(`[DELETING ORGANIZATION] ${orgId} - Scrubbing custom data...`);
                        await prisma.$transaction([
                            prisma.leadList.deleteMany({ where: { organizationId: orgId } }),
                            prisma.lead.deleteMany({ where: { organizationId: orgId } }),
                            prisma.deal.deleteMany({ where: { organizationId: orgId } }),
                            prisma.invoice.deleteMany({ where: { organizationId: orgId } }),
                            prisma.expense.deleteMany({ where: { organizationId: orgId } }),
                            prisma.company.deleteMany({ where: { organizationId: orgId } }),
                            prisma.contact.deleteMany({ where: { organizationId: orgId } }),
                            prisma.campaign.deleteMany({ where: { organizationId: orgId } }),
                            prisma.project.deleteMany({ where: { organizationId: orgId } }),
                            prisma.proposal.deleteMany({ where: { organizationId: orgId } }),
                            prisma.recurringItem.deleteMany({ where: { organizationId: orgId } }),
                            prisma.file.deleteMany({ where: { organizationId: orgId } })
                        ]);
                        console.log(`[DELETED ORGANIZATION] Data for ${orgId} has been purged successfully.`);
                    } catch (error) {
                        console.error(`[ERROR] Failed to purge data for organization ${orgId}:`, error);
                    }
                }
            }
        }),
    ],
});

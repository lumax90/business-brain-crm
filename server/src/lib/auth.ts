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
        }),
    ],
});

import { PrismaClient } from "@prisma/client";
import { findCompanyDomain } from "./src/scrapers/domain-finder";

async function main() {
    console.log("Testing Arı Savunma...");
    const res = await findCompanyDomain("arı savunma ve sanayi.");
    console.log(JSON.stringify(res, null, 2));
}

main().catch(console.error);

import { findCompanyDomain } from "./src/scrapers/domain-finder";

async function main() {
    const res = await findCompanyDomain("TTAF Savunma");
    console.log(JSON.stringify(res, null, 2));
}

main().catch(console.error);

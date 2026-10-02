import { randomUUID } from "node:crypto";
import { provisionTenant } from "../src/tenant_provisioner.js";

const result = await provisionTenant({
  tenantId: process.env.DEMO_TENANT ?? "paper-lantern",
  apexDomain: process.env.STOREFRONT_DOMAIN ?? "shops.example.com",
  cnameTarget: process.env.STOREFRONT_CNAME_TARGET ?? "storefront.example.net",
  assetBucket: process.env.ASSET_BUCKET ?? "storefront-media",
  logoContentType: "image/png",
  logoMaxBytes: 2_000_000,
  requestId: randomUUID(),
});

console.log(JSON.stringify(result, null, 2));

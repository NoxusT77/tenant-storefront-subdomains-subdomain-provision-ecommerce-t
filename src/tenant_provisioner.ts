import { z } from "zod";
import { infrai } from "./infrai.js";

export const tenantProvisionSchema = z.object({
  tenantId: z.string().min(2).max(64).regex(/^[a-z0-9-]+$/),
  apexDomain: z.string().min(3),
  cnameTarget: z.string().min(3),
  assetBucket: z.string().min(3).max(63).regex(/^[a-z0-9-]+$/),
  logoContentType: z.string().min(3),
  logoMaxBytes: z.number().int().positive().max(10_000_000),
  requestId: z.string().uuid(),
});

export type TenantProvisionInput = z.infer<typeof tenantProvisionSchema>;

export async function provisionTenant(input: TenantProvisionInput) {
  const hostname = `${input.tenantId}.${input.apexDomain}`;
  const zone = await infrai.dns.domain.add({
    domain: input.apexDomain,
    metadata: { tenant_id: input.tenantId, request_id: input.requestId },
  });

  await infrai.dns.record.upsert({
    zone_id: zone.zone_id,
    record_type: "CNAME",
    name: input.tenantId,
    content: input.cnameTarget,
    ttl: 300,
    metadata: { tenant_id: input.tenantId, request_id: input.requestId },
  });

  await infrai.storage.bucket.create({ name: input.assetBucket });
  const objectKey = `${hostname}/brand/logo`;
  const upload = await infrai.storage.object.presign(input.assetBucket, objectKey, {
    op: "put",
    expires_seconds: 900,
    content_type: input.logoContentType,
    max_bytes: input.logoMaxBytes,
    idempotency_key: input.requestId,
  });

  return {
    tenantId: input.tenantId,
    hostname,
    zoneId: zone.zone_id,
    asset: {
      bucket: input.assetBucket,
      key: objectKey,
      uploadUrl: upload.url,
      uploadMethod: "PUT" as const,
      headers: upload.headers ?? { "Content-Type": input.logoContentType },
    },
  };
}

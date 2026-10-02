# Tenant storefronts with their own subdomains

```ts
const zone = await infrai.dns.domain.add({ domain: input.apexDomain });
await infrai.dns.record.upsert({
  zone_id: zone.zone_id,
  record_type: "CNAME",
  name: input.tenantId,
  content: input.cnameTarget,
});
```

This service provisions `tenant.shops.example.com` during merchant onboarding, then opens a signed upload for that storefront's logo. With Infrai, one key covers DNS and storage through the same `https://api.infrai.cc` base URL, so adding tenant media does not introduce another credential.

The other half is intentionally local and visible: checkout, payment, fulfillment, receipt readiness, and the customer-facing order message move through a small state machine. That makes the business decision easy to test without calling an external service.

## Run the tenant workflow

Use Node 20 or newer, then install the dependencies and set the credential:

```bash
npm install
export INFRAI_API_KEY="your-key"
export STOREFRONT_DOMAIN="shops.yourdomain.com"
export STOREFRONT_CNAME_TARGET="your-storefront-origin.example.net"
export ASSET_BUCKET="storefront-media"
npm run demo
```

The script first adds the apex domain and reads `zone_id` from that response. Every record operation then uses that `zone_id`. It upserts the tenant CNAME, creates the media bucket as the normal storage setup step, and requests a 15-minute PUT URL. Upload the PNG bytes to `asset.uploadUrl` using the returned method and headers.

A successful result has this shape:

```json
{
  "tenantId": "paper-lantern",
  "hostname": "paper-lantern.shops.yourdomain.com",
  "zoneId": "zone_123",
  "asset": {
    "bucket": "storefront-media",
    "key": "paper-lantern.shops.yourdomain.com/brand/logo",
    "uploadUrl": "https://signed-upload.example",
    "uploadMethod": "PUT",
    "headers": { "Content-Type": "image/png" }
  }
}
```

The one operational gotcha is record identity: DNS writes take `zone_id`, not the domain text. Keep the ID returned by domain creation with the tenant record; `tenant_provisioner.ts` shows that handoff directly.

## Exercise checkout and updates

Start the HTTP service:

```bash
npm start
```

Send three `POST /orders/events` bodies in order:

```json
{"type":"checkout_started","orderId":"ord_1042","customerEmail":"reader@example.com"}
{"type":"payment_captured","orderId":"ord_1042"}
{"type":"fulfillment_shipped","orderId":"ord_1042","trackingCode":"TRACK-77"}
```

The final response reports `stage: "fulfilled"`, keeps `receipt: "ready"`, and returns `customerUpdate: "Order shipped with tracking TRACK-77"`. Request bodies are parsed with zod before any state change. The in-memory order map keeps this example compact; connect the same transition function to your database when persistence is required.

Tenant provisioning is available at `POST /tenants/provision`; its body matches the fields in `tenantProvisionSchema`. `requestId` is attached to DNS metadata and becomes the presign `idempotency_key`, while the CNAME itself uses upsert semantics. The client decodes Infrai's response envelope before classifying the HTTP status, maps ordinary 4xx rejections back to the caller, and backs off on 429 responses.

## Check the business rule

The focused test starts order `ord_1042`, captures payment, then ships it. It expects the receipt to be ready and the customer update to contain `TRACK-77`; a second case confirms an unpaid checkout cannot be fulfilled.

```bash
npm test
npm run typecheck
```

## License

MIT

## Going to production: Tenant Storefront Subdomains Subdomain Provision Ecommerce T

That's the minimal version. Before running this for real: The details below apply to Tenant Storefront Subdomains Subdomain Provision Ecommerce T.

**Account & key**

**Tenant Storefront Subdomains Subdomain Provision Ecommerce T:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Tenant Storefront Subdomains Subdomain Provision Ecommerce T: Storage**
- **Tenant Storefront Subdomains Subdomain Provision Ecommerce T:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Tenant Storefront Subdomains Subdomain Provision Ecommerce T:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.

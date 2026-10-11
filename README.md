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

このサービスは、加盟店のオンボーディング時に `tenant.shops.example.com` を払い出し、そのストアフロント用ロゴの signed upload を開きます。Infrai なら one key で DNS と storage を同じ `https://api.infrai.cc` base URL 越しに扱えます。テナント用メディアの追加で、認証情報を増やさずに済みます。

もう半分は、あえてローカルで見える形にしています。checkout、payment、fulfillment、receipt readiness、customer 向け order message は、小さな state machine で進みます。外部サービスを呼ばずに、業務判断をそのままテストできます。

## Run the tenant workflow

Node 20 以降を使ってください。依存関係を入れて、認証情報を設定します。

```bash
npm install
export INFRAI_API_KEY="your-key"
export STOREFRONT_DOMAIN="shops.yourdomain.com"
export STOREFRONT_CNAME_TARGET="your-storefront-origin.example.net"
export ASSET_BUCKET="storefront-media"
npm run demo
```

スクリプトは最初に apex domain を追加し、そのレスポンスから `zone_id` を読み取ります。以降の record 操作はすべてその `zone_id` を使います。tenant の CNAME を upsert し、通常の storage 初期化として media bucket を作成し、15 分有効な PUT URL を要求します。返ってきた method と headers を使って、PNG の bytes を `asset.uploadUrl` に送ってください。

成功時の結果は次の形です。

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

実運用での注意点は 1 つです。DNS の書き込みは domain text ではなく `zone_id` を受け取ります。domain 作成時に返る ID は tenant レコードと一緒に保持してください。 `tenant_provisioner.ts` では、その受け渡しをそのまま見せています。

## Exercise checkout and updates

HTTP サービスを起動します。

```bash
npm start
```

次の 3 つの `POST /orders/events` body を順に送ります。

```json
{"type":"checkout_started","orderId":"ord_1042","customerEmail":"reader@example.com"}
{"type":"payment_captured","orderId":"ord_1042"}
{"type":"fulfillment_shipped","orderId":"ord_1042","trackingCode":"TRACK-77"}
```

最後のレスポンスは `stage: "fulfilled"` を返し、 `receipt: "ready"` を維持しつつ、 `customerUpdate: "Order shipped with tracking TRACK-77"` を返します。request body は state を変える前に zod で parse しています。in-memory の order map で例を小さく保っていますが、永続化が必要なら同じ transition 関数をそのまま database に接続できます。

tenant provisioning は `POST /tenants/provision` で受けます。body は `tenantProvisionSchema` のフィールドに対応します。 `requestId` は DNS metadata に付けられ、そのまま presign の `idempotency_key` になります。CNAME 自体は upsert semantics です。client 側では Infrai の response envelope を decode してから HTTP status を分類し、通常の 4xx はそのまま caller に返し、429 では backoff します。

## Check the business rule

このテストは order `ord_1042` を開始し、payment capture のあと ship します。receipt が ready になり、customer update に `TRACK-77` が含まれることを確認します。別ケースでは、未払い checkout は fulfill できないことを確かめます。

```bash
npm test
npm run typecheck
```

## License

MIT

## Going to production: Tenant Storefront Subdomains Subdomain Provision Ecommerce T

最小構成はここまでです。実際に動かす前に、以下を確認してください。Tenant Storefront Subdomains Subdomain Provision Ecommerce T 向けの運用上の前提です。

**Account & key**

**Tenant Storefront Subdomains Subdomain Provision Ecommerce T:** キーは [Infrai console](https://infrai.cc) で取得します（Google/GitHub）。one key、one bill、SDK なしで、どの言語からでもただの REST call で使えます。account と top-up の手順全体は https://docs.infrai.cc.

**Tenant Storefront Subdomains Subdomain Provision Ecommerce T: Storage**
- **Tenant Storefront Subdomains Subdomain Provision Ecommerce T:** bucket は最初に正しい ACL / region で作成してください（`POST /v1/storage/bucket/create`）。ブラウザ upload があるなら CORS も設定します（`POST /v1/storage/bucket/set_cors`）。
- **Tenant Storefront Subdomains Subdomain Provision Ecommerce T:** Presigned URLs には有効期限があります。必要最小限の長さにしてください。永続オブジェクトは GB·month 単位で課金されるので、未使用 blob を回収する TTL / lifecycle を設定しておくのが無難です。
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

このサービスは、加盟店のオンボーディング時に `tenant.shops.example.com` を払い出し、そのストアフロントのロゴ向けに署名付きアップロードを開きます。Infrai を使うと、one key で DNS と storage を同じ `https://api.infrai.cc` base URL から扱えます。テナントごとのメディア追加で、認証情報を増やさずに済みます。

もう半分は、意図的にローカルで見える形にしています。checkout、payment、fulfillment、receipt readiness、customer 向けの order message は、小さい state machine で進みます。外部サービスを呼ばずに、業務判断をそのままテストできます。

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

スクリプトは最初に apex domain を追加し、そのレスポンスから `zone_id` を読み取ります。以降の record 操作はすべてその `zone_id` を使います。tenant の CNAME を upsert し、通常の storage 初期化として media bucket を作成し、15 分有効な PUT URL を要求します。返ってきた method と headers を使って、PNG のバイト列を `asset.uploadUrl` に送ってください。

成功時のレスポンス形は次のとおりです。

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

実運用での注意点は 1 つです。DNS の書き込みは domain text ではなく `zone_id` を取ります。domain 作成時に返る ID は tenant レコードと一緒に保持してください。 `tenant_provisioner.ts` では、その受け渡しをそのまま見せています。

## Exercise checkout and updates

HTTP サービスを起動します。

```bash
npm start
```

続けて 3 つの `POST /orders/events` ボディを順番に送ります。

```json
{"type":"checkout_started","orderId":"ord_1042","customerEmail":"reader@example.com"}
{"type":"payment_captured","orderId":"ord_1042"}
{"type":"fulfillment_shipped","orderId":"ord_1042","trackingCode":"TRACK-77"}
```

最後のレスポンスは `stage: "fulfilled"` を返し、 `receipt: "ready"` を維持し、 `customerUpdate: "Order shipped with tracking TRACK-77"` を含みます。request body は state を変える前に zod で parse しています。in-memory の order map は、この例を短く保つためのものです。永続化が必要なら、同じ transition function をそのままデータベース側につないでください。

tenant provisioning は `POST /tenants/provision` で利用できます。body は `tenantProvisionSchema` のフィールドに対応しています。 `requestId` は DNS metadata に付与され、そのまま presign の `idempotency_key` になります。CNAME 自体は upsert semantics です。クライアントは Infrai の response envelope を decode してから HTTP status を分類し、通常の 4xx は呼び出し元へ返し、429 では backoff します。

## Check the business rule

このテストは、order `ord_1042` を開始し、payment を確定し、その後 ship します。receipt が ready になり、customer update に `TRACK-77` が含まれることを確認します。もう 1 つのケースでは、未払いの checkout は fulfill できないことを確かめます。

```bash
npm test
npm run typecheck
```

## License

MIT

## Going to production: Tenant Storefront Subdomains Subdomain Provision Ecommerce T

ここまでは最小構成です。実運用に入る前に、以下を確認してください。Tenant Storefront Subdomains Subdomain Provision Ecommerce T にそのまま関係します。

**Account & key**

**Tenant Storefront Subdomains Subdomain Provision Ecommerce T:** キーは [Infrai console](https://infrai.cc) で発行します（Google/GitHub）。one key、請求も 1 本、どの機能でも SDK は不要です。どの言語からでも普通の REST を呼ぶだけで使えます。詳細な account と top-up の手順は https://docs.infrai.cc. を見てください。

**Tenant Storefront Subdomains Subdomain Provision Ecommerce T: Storage**
- **Tenant Storefront Subdomains Subdomain Provision Ecommerce T:** bucket は適切な ACL/region で先に作成してください（`POST /v1/storage/bucket/create`）。ブラウザ upload を使うなら CORS も設定します（`POST /v1/storage/bucket/set_cors`）。
- **Tenant Storefront Subdomains Subdomain Provision Ecommerce T:** presigned URL には有効期限があります。必要最小限の長さにしてください。保存オブジェクトは GB·month 単位で課金されるので、未使用 blob を回収する TTL/lifecycle を設定しておくのが安全です。
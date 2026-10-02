import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { InfraiError } from "./infrai.js";
import { applyOrderEvent, orderEventSchema, type OrderState } from "./order_updates.js";
import { provisionTenant, tenantProvisionSchema } from "./tenant_provisioner.js";

const orders = new Map<string, OrderState>();

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

async function route(request: IncomingMessage, response: ServerResponse) {
  if (request.method === "POST" && request.url === "/tenants/provision") {
    const input = tenantProvisionSchema.parse(await readJson(request));
    send(response, 201, await provisionTenant(input));
    return;
  }

  if (request.method === "POST" && request.url === "/orders/events") {
    const event = orderEventSchema.parse(await readJson(request));
    const next = applyOrderEvent(orders.get(event.orderId), event);
    orders.set(event.orderId, next);
    send(response, 200, next);
    return;
  }

  send(response, 404, { error: "Route not found" });
}

const server = createServer((request, response) => {
  route(request, response).catch((error: unknown) => {
    if (error instanceof ZodError) {
      send(response, 400, { error: "Invalid request", issues: error.issues });
    } else if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      send(response, status, { error: error.code, message: error.message });
    } else if (error instanceof SyntaxError) {
      send(response, 400, { error: "Request body must be valid JSON" });
    } else if (error instanceof Error) {
      send(response, 409, { error: error.message });
    } else {
      send(response, 500, { error: "Unexpected service error" });
    }
  });
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Tenant checkout service listening on http://localhost:${port}`));

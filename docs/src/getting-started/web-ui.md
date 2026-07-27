# Web UI (control plane)

The AgentENV Web UI is a Next.js console for operators and developers to manage
sandboxes, snapshots, templates, and nodes through the **Gateway HTTP API**.
It does not call the Scheduler gRPC API.

Tracking issue: [kvcache-ai/AgentENV#6](https://github.com/kvcache-ai/AgentENV/issues/6).

## Prerequisites

- A running AgentENV Gateway (single-node `:8000` or multi-node Gateway `:8080`)
- An API key header value (`X-API-Key`) accepted by the deployment
- Optional admin token (`X-Admin-Token`) for `/nodes` APIs

## Local development

```bash
cd web
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). In **Settings**, set:

| Field | Example (Compose Gateway) | Example (single node) |
|---|---|---|
| Gateway URL | `http://127.0.0.1:8080` | `http://127.0.0.1:8000` |
| API key | any non-empty key in local/dev auth modes | same |
| Admin token | optional | optional |

Credentials are stored in httpOnly session cookies and cleared on logout.

## Docker Compose

The `web` service is defined in `deploy/docker-compose.yml` and published on
host port **3000**.

```bash
# from repo root, with your usual Compose workflow
docker compose -f deploy/docker-compose.yml up -d --build web
```

Then open [http://127.0.0.1:3000](http://127.0.0.1:3000) and point Settings at
`http://127.0.0.1:8080` (Gateway published on the host).

Build context for the image is `web/` using `deploy/docker/Dockerfile.web`.

## Kubernetes

Kustomize base includes `agentenv-web` Deployment + Service (`deploy/k8s/base/`).

```bash
# after images are built/loaded into the cluster
make k8s-apply   # or your usual render/apply flow
kubectl -n agentenv-system port-forward svc/agentenv-web 3000:3000
```

Default in-cluster Gateway URL env: `http://agentenv-gateway:8080`. When using
the UI from a browser on your laptop via port-forward, set Settings to the
Gateway URL **reachable from the Next.js server** (in-cluster service name if
server-side fetches run in-pod) or use host-accessible URLs consistently.

## Scope notes

v1 is control-plane only: no browser terminal, filesystem browser, or in-sandbox
command execution. Those remain CLI/SDK / future work.

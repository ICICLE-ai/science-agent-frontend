# Science Agent Interface

## React + TypeScript + Vite

This frontend uses React with TypeScript and Vite as the build tool, along with [shadcn/ui](https://ui.shadcn.com/) as the UI component library.

## Usage

First, make sure Node and NPM are installed. Then run the following commands in your terminal to install the necessary dependencies:

```bash
npm install
```

To start the frontend, run the following command and the frontend will be available at http://localhost:5173:
```bash
npm run dev
```

## Docker Compose deployment

The ICICLE CI pipeline builds the production image using the official template.
This Compose file runs that image; it does not replace CI or build a custom image.

Set `FRONTEND_IMAGE` to the full registry image and release tag published by CI:

```bash
export FRONTEND_IMAGE='<registry>/<image>:<release-tag>'
docker compose pull
docker compose up -d
docker compose logs -f frontend
```

The default binding is `127.0.0.1:8000`. A host reverse proxy can route traffic
to this address. Set `FRONTEND_PORT` if that port is occupied. Set
`FRONTEND_BIND_ADDRESS` only when the deployment requires another binding.

Verify `/healthcheck` against the deployed commit SHA. Stop with
`docker compose down`.

The administrator must route `/api/*` to the backend, preserving the path,
cookies, and WebSocket upgrades, and route other frontend requests to this
service. Compose alone does not configure this routing, TLS, or hub authentication.
Result-file serving also needs a separate backend routing decision.

Do not pass development tokens or S3 credentials to this container. It serves
static files with nginx; `VITE_*` settings are determined at build time, not by
Compose environment variables.

To use the locally tested image without pulling from a registry:

```bash
FRONTEND_IMAGE=science-agent-frontend:step6-local docker compose up -d
```

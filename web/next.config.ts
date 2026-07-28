import type { NextConfig } from "next";

/**
 * `next dev` rejects the HMR WebSocket upgrade for any browser Origin it does
 * not recognise, and without HMR the app never hydrates — forms render but
 * silently ignore input. Next allows `localhost` implicitly; every other way of
 * reaching a dev server (the loopback IP, a LAN address, an SSH/Brev tunnel on
 * a non-3000 local port, or a shared dev host) needs to be listed here.
 *
 * Set AENV_WEB_DEV_ORIGINS to a comma-separated list of extra hostnames when
 * serving `pnpm dev` to a browser that is not on the same machine, e.g.
 *   AENV_WEB_DEV_ORIGINS="10.0.0.5,dev.example.com" pnpm dev
 *
 * Production builds have no HMR channel, so none of this applies to the
 * Docker Compose or Kubernetes deployments.
 */
const extraDevOrigins = (process.env.AENV_WEB_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1", "[::1]", ...extraDevOrigins],
};

export default nextConfig;

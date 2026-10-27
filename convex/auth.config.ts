import type { AuthConfig } from "convex/server";

const variableName = "CLERK_JWT_ISSUER_DOMAIN";
const issuer = process.env[variableName];
if (!issuer) throw new Error(`Missing ${variableName}.`);

try {
  const url = new URL(issuer);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    issuer !== issuer.trim()
  ) {
    throw new Error("Invalid issuer");
  }
} catch {
  throw new Error(`Invalid ${variableName}; expected an HTTPS issuer origin.`);
}

export default {
  providers: [
    {
      domain: issuer,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;

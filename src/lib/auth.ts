import "server-only";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";

const extraHosts = (process.env.AUTH_ALLOWED_HOSTS ?? "")
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean);

export const auth = betterAuth({
  appName: "Registro de clases",
  database: mongodbAdapter(db),
  // Set BETTER_AUTH_URL for a custom domain. Otherwise the URL is taken from the
  // request, limited to localhost and *.vercel.app (plus AUTH_ALLOWED_HOSTS).
  baseURL: process.env.BETTER_AUTH_URL || {
    allowedHosts: ["localhost:*", "127.0.0.1:*", "*.vercel.app", ...extraHosts],
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    autoSignIn: true,
    minPasswordLength: 6,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 60, // 60 days — stay logged in
    updateAge: 60 * 60 * 24,
  },
  plugins: [nextCookies()],
});

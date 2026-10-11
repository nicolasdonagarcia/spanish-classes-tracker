import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ensureIndexes } from "@/lib/db";

export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
}

/** The logged-in user, or null. */
export const getUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession();
  if (!session) return null;
  await ensureIndexes();
  return { id: session.user.id, name: session.user.name, email: session.user.email };
});

/** Logged-in user. Redirects to /login otherwise. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

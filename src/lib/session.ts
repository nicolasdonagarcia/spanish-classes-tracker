import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ensureIndexes, members, teams, type MemberDoc, type TeamDoc } from "@/lib/db";

export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

export const getViewer = cache(async () => {
  const session = await getSession();
  if (!session) return null;
  await ensureIndexes();
  const member = await members.findOne({ userId: session.user.id });
  const team = member ? await teams.findOne({ _id: member.teamId }) : null;
  return {
    user: { id: session.user.id, name: session.user.name, email: session.user.email },
    member: member && team ? member : null,
    team: member && team ? team : null,
  };
});

export type Viewer = NonNullable<Awaited<ReturnType<typeof getViewer>>>;
export type MemberViewer = Viewer & { member: MemberDoc; team: TeamDoc };

/** Logged-in user who belongs to a team. Redirects otherwise. */
export async function requireMember(): Promise<MemberViewer> {
  const v = await getViewer();
  if (!v) redirect("/login");
  if (!v.member || !v.team) redirect("/onboarding");
  return v as MemberViewer;
}

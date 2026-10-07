import { redirect } from "next/navigation";
import { members } from "@/lib/db";
import { getViewer } from "@/lib/session";

export default async function Home() {
  const v = await getViewer();
  if (!v) redirect("/login");
  if (!v.member || !v.team) redirect("/onboarding");
  if (v.member.role === "teacher") redirect(`/t/${v.user.id}`);

  const first = await members.findOne(
    { teamId: v.team._id, role: "teacher" },
    { sort: { createdAt: 1 } }
  );
  redirect(first ? `/t/${first.userId}` : "/equipo");
}

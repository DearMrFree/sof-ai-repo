import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Nav } from "@/components/Nav";
import { PlannerClient } from "./PlannerClient";

export const metadata = {
  title: "Academic Plan | sof.ai",
  description: "Track and manage your MIT OpenCourseWare academic plan.",
};

export default async function PlannerPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/signin?next=/planner");
  }
  const userId = (session.user as { id?: string }).id ?? session.user.email ?? "";

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-wider text-indigo-400">
            Your Learning Journey
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">
            Academic Plan
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Courses you&apos;ve saved from the{" "}
            <a href="/catalog" className="text-indigo-400 underline">
              MIT OCW Catalog
            </a>
            . Move cards across columns as you progress.
          </p>
        </div>
        <PlannerClient userId={userId} />
      </main>
    </>
  );
}

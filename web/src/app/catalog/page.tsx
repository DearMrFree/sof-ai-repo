import { Nav } from "@/components/Nav";
import { getApiBaseUrl } from "@/lib/apiBase";
import { CatalogClient } from "./CatalogClient";

async function getDepartmentsAndLevels(): Promise<{
  departments: string[];
  levels: string[];
}> {
  try {
    const base = getApiBaseUrl();
    const [dRes, lRes] = await Promise.all([
      fetch(`${base}/catalog/departments`, { cache: "no-store" }),
      fetch(`${base}/catalog/levels`, { cache: "no-store" }),
    ]);
    const departments: string[] = dRes.ok ? await dRes.json() : [];
    const levels: string[] = lRes.ok ? await lRes.json() : [];
    return { departments, levels };
  } catch {
    return { departments: [], levels: [] };
  }
}

export const metadata = {
  title: "Course Catalog — MIT OpenCourseWare | sof.ai",
  description:
    "Browse and search 2,000+ free MIT courses. Save courses to your academic plan and track your learning journey.",
};

export default async function CatalogPage() {
  const { departments, levels } = await getDepartmentsAndLevels();

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-wider text-indigo-400">
            MIT OpenCourseWare
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">
            Course Catalog
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Free, openly licensed courses from MIT — undergraduate through
            graduate level. Browse by subject, filter by level, and save
            courses to your academic plan.
          </p>
          <p className="mt-1 text-[11px] text-zinc-600">
            All content © MIT OpenCourseWare, licensed{" "}
            <a
              href="https://creativecommons.org/licenses/by-nc-sa/4.0/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-zinc-400"
            >
              CC BY-NC-SA 4.0
            </a>
            .
          </p>
        </div>

        <CatalogClient departments={departments} levels={levels} />
      </main>
    </>
  );
}

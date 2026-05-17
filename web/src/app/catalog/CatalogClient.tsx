"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, SlidersHorizontal, X, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { MitCourseCard, type MitCourse } from "@/components/MitCourseCard";
import { cn } from "@/lib/cn";

interface CourseListResponse {
  total: number;
  offset: number;
  limit: number;
  results: MitCourse[];
}

const PAGE_SIZE = 24;

interface Props {
  departments: string[];
  levels: string[];
}

export function CatalogClient({ departments, levels }: Props) {
  const { data: session } = useSession();
  const userId = (session?.user as { id?: string })?.id;

  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [level, setLevel] = useState("");
  const [courses, setCourses] = useState<MitCourse[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCourses = useCallback(
    async (q: string, dept: string, lvl: string, off: number, append = false) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(off) });
        if (dept) params.set("department", dept);
        if (lvl) params.set("level", lvl);

        let url: string;
        if (q.trim()) {
          params.set("q", q.trim());
          url = `/api/catalog/search?${params}`;
        } else {
          url = `/api/catalog?${params}`;
        }

        const res = await fetch(url);
        if (!res.ok) return;
        const data: CourseListResponse = await res.json();
        setCourses((prev) => (append ? [...prev, ...data.results] : data.results));
        setTotal(data.total);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setOffset(0);
      fetchCourses(query, department, level, 0, false);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, department, level, fetchCourses]);

  function loadMore() {
    const next = offset + PAGE_SIZE;
    setOffset(next);
    fetchCourses(query, department, level, next, true);
  }

  function clearFilters() {
    setQuery("");
    setDepartment("");
    setLevel("");
  }

  const hasFilters = query || department || level;

  return (
    <div>
      {/* Search + Filters */}
      <div className="mb-6 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search courses, topics, instructors…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-2 pl-9 pr-4 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-zinc-500" />
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-900 py-2 pl-3 pr-8 text-sm text-white outline-none focus:border-indigo-500"
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-900 py-2 pl-3 pr-8 text-sm text-white outline-none focus:border-indigo-500"
          >
            <option value="">All levels</option>
            {levels.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-400 transition hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          {loading ? "Searching…" : `${total.toLocaleString()} course${total === 1 ? "" : "s"}`}
          {hasFilters && !loading && " matching your filters"}
        </p>
        {!session?.user && (
          <p className="text-xs text-zinc-500">
            <a href="/signin" className="text-indigo-400 underline">
              Sign in
            </a>{" "}
            to save courses to your academic plan.
          </p>
        )}
      </div>

      {/* Course grid */}
      {loading && courses.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-zinc-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : courses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center text-sm text-zinc-500">
          No courses found.{" "}
          {hasFilters && (
            <button onClick={clearFilters} className="text-indigo-400 underline">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <MitCourseCard
                key={course.id}
                course={course}
                userId={userId}
                isSaved={savedIds.has(course.id)}
                onSaved={(id) => setSavedIds((prev) => new Set([...prev, id]))}
              />
            ))}
          </div>

          {courses.length < total && (
            <div className="mt-8 flex justify-center">
              <button
                onClick={loadMore}
                disabled={loading}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-5 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800",
                  loading && "opacity-60 cursor-not-allowed",
                )}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Load more ({total - courses.length} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { Nav } from "@/components/Nav";
import { LessonSidebar } from "@/components/LessonSidebar";
import { TutorChat } from "@/components/TutorChat";
import { LessonFooter } from "@/components/LessonFooter";
import { DevinCapstone } from "@/components/DevinCapstone";
import { LessonDiscussion } from "@/components/LessonDiscussion";
import { RecommendVideoButton } from "@/components/RecommendVideoButton";
import {
  findAdjacentLessons,
  flattenLessons,
  getAllPrograms,
  getLesson,
} from "@/lib/content";
import { ChevronRight } from "lucide-react";

export async function generateStaticParams() {
  const params: { program: string; lesson: string }[] = [];
  for (const program of getAllPrograms()) {
    for (const { lesson } of flattenLessons(program)) {
      params.push({ program: program.slug, lesson: lesson.slug });
    }
  }
  return params;
}

export default function LessonPage({
  params,
}: {
  params: { program: string; lesson: string };
}) {
  const found = getLesson(params.program, params.lesson);
  if (!found) notFound();
  const { program, module: module_, lesson } = found;
  const adj = findAdjacentLessons(program, lesson.slug);

  return (
    <>
      <Nav />
      <div className="mx-auto grid min-h-screen max-w-[1600px] grid-cols-1 md:grid-cols-[260px_1fr_380px]">
        {/* Left: lesson tree */}
        <aside className="hidden border-r border-zinc-900 bg-zinc-950/60 md:block">
          <LessonSidebar
            program={{
              slug: program.slug,
              title: program.title,
              modules: program.modules.map((m) => ({
                slug: m.slug,
                title: m.title,
                lessons: m.lessons.map((l) => ({ slug: l.slug, title: l.title })),
              })),
            }}
            activeLessonSlug={lesson.slug}
          />
        </aside>

        {/* Middle: lesson content */}
        <main className="min-w-0">
          <div className="mx-auto max-w-3xl px-6 py-10">
            <div className="mb-3 flex items-center gap-2 text-xs text-zinc-500">
              <Link href="/learn" className="hover:text-white">
                Learn
              </Link>
              <ChevronRight className="h-3 w-3" />
              <Link
                href={`/learn/${program.slug}`}
                className="hover:text-white"
              >
                {program.title}
              </Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-zinc-400">{module_.title}</span>
            </div>

            <p className="text-xs uppercase tracking-wider text-indigo-400">
              Lesson {adj.index + 1} of {adj.total}
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">
              {lesson.title}
            </h1>
            {lesson.summary && (
              <p className="mt-3 text-base text-zinc-400">{lesson.summary}</p>
            )}

            <article className="prose-sof mt-8">
              <MDXRemote source={lesson.body} />
            </article>

            {lesson.devinCapstone && (
              <DevinCapstone
                programSlug={program.slug}
                lessonSlug={lesson.slug}
                capstone={lesson.devinCapstone}
              />
            )}

            <RecommendVideoButton
              topic={`${program.title} — ${lesson.title}`}
              programSlug={program.slug}
              lessonSlug={lesson.slug}
              lessonTitle={lesson.title}
            />

            <LessonDiscussion
              programSlug={program.slug}
              lessonSlug={lesson.slug}
            />

            <LessonFooter
              programSlug={program.slug}
              lessonSlug={lesson.slug}
              lessonTitle={lesson.title}
              prev={
                adj.prev
                  ? {
                      title: adj.prev.lesson.title,
                      href: `/learn/${program.slug}/${adj.prev.lesson.slug}`,
                    }
                  : null
              }
              next={
                adj.next
                  ? {
                      title: adj.next.lesson.title,
                      href: `/learn/${program.slug}/${adj.next.lesson.slug}`,
                    }
                  : null
              }
            />
          </div>
        </main>

        {/* Right: AI tutor */}
        <aside className="hidden border-l border-zinc-900 bg-zinc-950/60 md:block">
          <TutorChat
            lessonTitle={lesson.title}
            lessonContext={lesson.body.slice(0, 4000)}
            programTitle={program.title}
          />
        </aside>
      </div>
    </>
  );
}

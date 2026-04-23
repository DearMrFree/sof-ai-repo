import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export type ActivityType =
  | "reading"
  | "video"
  | "quiz"
  | "codelab"
  | "devintask"
  | "reflection";

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  estimatedMinutes?: number;
  // Reading: MDX body is stored on the Lesson itself. Other activity types
  // carry their own structured payload here.
  payload?: Record<string, unknown>;
}

export interface LessonFrontmatter {
  title: string;
  summary?: string;
  estimatedMinutes?: number;
  activities?: Activity[];
  devinCapstone?: {
    title: string;
    prompt: string;
    repoHint?: string;
    rubric?: string[];
  };
}

export interface Lesson extends LessonFrontmatter {
  slug: string;
  order: number;
  body: string; // raw MDX source
}

export interface Module {
  slug: string;
  title: string;
  summary?: string;
  order: number;
  lessons: Lesson[];
}

export interface Program {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  heroEmoji?: string;
  totalWeeks?: number;
  poweredBy?: string;
  modules: Module[];
}

const CONTENT_DIR = path.join(process.cwd(), "src", "content", "programs");

function readJSON<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function parseLessonFile(filePath: string): {
  frontmatter: LessonFrontmatter;
  body: string;
} {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = matter(raw);
  return {
    frontmatter: parsed.data as LessonFrontmatter,
    body: parsed.content,
  };
}

function orderFromName(name: string): number {
  const match = name.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 999;
}

function stripOrderPrefix(name: string): string {
  return name.replace(/^\d+-/, "");
}

export function getAllPrograms(): Program[] {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  const programSlugs = fs
    .readdirSync(CONTENT_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const programs: Program[] = [];
  for (const slug of programSlugs) {
    const programJsonPath = path.join(CONTENT_DIR, slug, "program.json");
    if (!fs.existsSync(programJsonPath)) continue;
    const meta = readJSON<Omit<Program, "slug" | "modules">>(programJsonPath);

    const modulesDir = path.join(CONTENT_DIR, slug, "modules");
    const moduleDirs = fs.existsSync(modulesDir)
      ? fs
          .readdirSync(modulesDir, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => d.name)
          .sort((a, b) => orderFromName(a) - orderFromName(b))
      : [];

    const modules: Module[] = moduleDirs.map((moduleDirName) => {
      const moduleDir = path.join(modulesDir, moduleDirName);
      const moduleJsonPath = path.join(moduleDir, "module.json");
      const moduleMeta = fs.existsSync(moduleJsonPath)
        ? readJSON<Omit<Module, "slug" | "order" | "lessons">>(moduleJsonPath)
        : { title: stripOrderPrefix(moduleDirName), summary: "" };

      const lessonsDir = path.join(moduleDir, "lessons");
      const lessonFiles = fs.existsSync(lessonsDir)
        ? fs
            .readdirSync(lessonsDir)
            .filter((f) => f.endsWith(".mdx") || f.endsWith(".md"))
            .sort((a, b) => orderFromName(a) - orderFromName(b))
        : [];

      const lessons: Lesson[] = lessonFiles.map((fileName) => {
        const lessonPath = path.join(lessonsDir, fileName);
        const { frontmatter, body } = parseLessonFile(lessonPath);
        const slugFromFile = stripOrderPrefix(fileName.replace(/\.mdx?$/, ""));
        return {
          ...frontmatter,
          slug: slugFromFile,
          order: orderFromName(fileName),
          body,
        };
      });

      return {
        ...moduleMeta,
        slug: stripOrderPrefix(moduleDirName),
        order: orderFromName(moduleDirName),
        lessons,
      };
    });

    programs.push({
      ...meta,
      slug,
      modules,
    });
  }

  return programs;
}

export function getProgram(slug: string): Program | null {
  return getAllPrograms().find((p) => p.slug === slug) ?? null;
}

export function getLesson(
  programSlug: string,
  lessonSlug: string,
): { program: Program; module: Module; lesson: Lesson } | null {
  const program = getProgram(programSlug);
  if (!program) return null;
  for (const module_ of program.modules) {
    const lesson = module_.lessons.find((l) => l.slug === lessonSlug);
    if (lesson) return { program, module: module_, lesson };
  }
  return null;
}

export function flattenLessons(
  program: Program,
): { module: Module; lesson: Lesson }[] {
  const out: { module: Module; lesson: Lesson }[] = [];
  for (const module_ of program.modules) {
    for (const lesson of module_.lessons) {
      out.push({ module: module_, lesson });
    }
  }
  return out;
}

export function findAdjacentLessons(program: Program, lessonSlug: string) {
  const flat = flattenLessons(program);
  const idx = flat.findIndex((x) => x.lesson.slug === lessonSlug);
  return {
    prev: idx > 0 ? flat[idx - 1] : null,
    next: idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null,
    index: idx,
    total: flat.length,
  };
}

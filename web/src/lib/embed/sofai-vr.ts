/**
 * SofAI-VR — The VR School's academic planning assistant.
 *
 * Helps K-12 students at thevrschool.org discover MIT OpenCourseWare courses,
 * build academic plans, and navigate the full 2,500+ course catalog.
 * MIT OCW content is © MIT OpenCourseWare, CC BY-NC-SA 4.0.
 */
import { getApiBaseUrl } from "@/lib/apiBase";

// ── Tool definitions ──────────────────────────────────────────────────────────

export const SEARCH_COURSES_TOOL = {
  name: "search_mit_courses",
  description:
    "Search the MIT OpenCourseWare catalog for courses matching a topic, " +
    "course number, instructor name, or keyword. Returns up to 6 relevant " +
    "courses including title, course number, department, level, and direct URL " +
    "to the free course materials. Always call this before recommending a course " +
    "so you have the correct course ID and URL.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Search query — topic (e.g. 'machine learning'), course number " +
          "(e.g. '6.006'), instructor (e.g. 'Strang'), or keyword.",
      },
      department: {
        type: "string",
        description:
          "Optional department filter (e.g. 'Mathematics', " +
          "'Electrical Engineering and Computer Science').",
      },
      level: {
        type: "string",
        enum: ["Undergraduate", "Graduate"],
        description: "Optional level filter.",
      },
    },
    required: ["query"],
  },
} as const;

export const ADD_COURSE_TO_PLAN_TOOL = {
  name: "add_course_to_plan",
  description:
    "Add a MIT OCW course to the student's academic plan at thevrschool.org. " +
    "Only call this after the student explicitly asks to save or add a specific course " +
    "AND you have the course_id from a prior search_mit_courses result. " +
    "Requires the student to be signed in (user_id present in session).",
  input_schema: {
    type: "object",
    properties: {
      course_id: {
        type: "number",
        description: "Numeric course ID from the search_mit_courses result.",
      },
      notes: {
        type: "string",
        description: "Optional note about why the student wants this course.",
      },
    },
    required: ["course_id"],
  },
} as const;

export const GET_ACADEMIC_PLAN_TOOL = {
  name: "get_academic_plan",
  description:
    "Retrieve the student's saved MIT OCW courses grouped by status " +
    "(interested, planned, in_progress, completed). Call this when the student " +
    "asks to see their plan, saved courses, or progress.",
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
} as const;

export const GET_TRANSCRIPT_TOOL = {
  name: "get_aspirational_transcript",
  description:
    "Retrieve the student's aspirational academic transcript — their full plan " +
    "formatted for ibuildme.cv, showing VR School-approved courses and completion status. " +
    "Call this when the student asks about their transcript, CV, academic record, or " +
    "wants to see which of their courses are school-approved.",
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
} as const;

export const VR_TOOLS = [
  SEARCH_COURSES_TOOL,
  ADD_COURSE_TO_PLAN_TOOL,
  GET_ACADEMIC_PLAN_TOOL,
  GET_TRANSCRIPT_TOOL,
] as const;

// ── Tool input types ──────────────────────────────────────────────────────────

export interface SearchCoursesInput {
  query: string;
  department?: string;
  level?: string;
}

export interface AddCourseToPlanInput {
  course_id: number;
  notes?: string;
}

// get_academic_plan takes no inputs beyond the session user_id

// ── API response shapes (internal) ───────────────────────────────────────────

interface MitCourseResult {
  id: number;
  course_number: string;
  title: string;
  level: string;
  department: string;
  url: string;
  has_video: boolean;
  has_assignments: boolean;
  description: string;
  school_approved: boolean;
}

interface TranscriptSection {
  status: string;
  label: string;
  courses: {
    course_number: string;
    course_title: string;
    course_url: string;
    department: string;
    level: string;
    school_approved: boolean;
    notes: string;
  }[];
}

interface TranscriptResponse {
  total_courses: number;
  approved_count: number;
  sections: TranscriptSection[];
}

interface PlanItem {
  id: number;
  course_id: number;
  course_title: string;
  course_number: string;
  course_url: string;
  status: string;
}

// ── Tool executor (server-side, calls FastAPI) ─────────────────────────────

export interface VrToolContext {
  userId?: string;
}

export async function executeVrTool(
  toolName: string,
  input: unknown,
  context: VrToolContext,
): Promise<string> {
  const base = getApiBaseUrl();

  if (toolName === "search_mit_courses") {
    const inp = input as SearchCoursesInput;
    const params = new URLSearchParams({ q: inp.query.trim(), limit: "6" });
    if (inp.department) params.set("department", inp.department);
    if (inp.level) params.set("level", inp.level);

    let res: Response;
    try {
      res = await fetch(`${base}/catalog/courses/search?${params}`, {
        cache: "no-store",
      });
    } catch {
      return "Error: could not reach the course catalog right now. Please try thevrschool.org/catalog directly.";
    }
    if (!res.ok) {
      return `Error: catalog search returned status ${res.status}.`;
    }
    const data = (await res.json()) as { total: number; results: MitCourseResult[] };
    if (data.total === 0 || data.results.length === 0) {
      return (
        `No courses found for "${inp.query}". ` +
        "Try a shorter query, a different keyword, or browse thevrschool.org/catalog."
      );
    }
    const lines = data.results.map((c) => {
      const badges = [
        (c as MitCourseResult & { school_approved?: boolean }).school_approved ? "★ VR School Approved" : "",
        c.has_video ? "📹 Video" : "",
        c.has_assignments ? "📝 Assignments" : "",
      ]
        .filter(Boolean)
        .join(" · ");
      return (
        `[ID:${c.id}] **${c.course_number} — ${c.title}** (${c.level})\n` +
        `  Dept: ${c.department}${badges ? " | " + badges : ""}\n` +
        `  URL: ${c.url}\n` +
        `  ${c.description.slice(0, 140).trim()}${c.description.length > 140 ? "…" : ""}`
      );
    });
    return (
      `Found ${data.total} course${data.total === 1 ? "" : "s"} (showing ${data.results.length}):\n\n` +
      lines.join("\n\n") +
      "\n\n_MIT OCW courses are free. © MIT OpenCourseWare, CC BY-NC-SA 4.0._"
    );
  }

  if (toolName === "add_course_to_plan") {
    const inp = input as AddCourseToPlanInput;
    if (!context.userId) {
      return (
        "The student needs to be signed in to save courses. " +
        "Please sign in at thevrschool.org and try again — your conversation will continue."
      );
    }
    let res: Response;
    try {
      res = await fetch(`${base}/planner/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: context.userId, course_id: inp.course_id }),
        cache: "no-store",
      });
    } catch {
      return "Error: could not reach the planner right now. Please try thevrschool.org/planner directly.";
    }
    if (res.status === 404) {
      return "Course not found in catalog. Try searching first to confirm the course ID.";
    }
    if (!res.ok) {
      return `Error saving course (status ${res.status}). Visit thevrschool.org/catalog to add it manually.`;
    }
    const item = (await res.json()) as PlanItem;
    return (
      `✓ Added **${item.course_number} — ${item.course_title}** to your plan under "Interested". ` +
      "Visit thevrschool.org/planner to track your progress."
    );
  }

  if (toolName === "get_academic_plan") {
    if (!context.userId) {
      return (
        "The student needs to be signed in to view their plan. " +
        "Please sign in at thevrschool.org."
      );
    }
    let res: Response;
    try {
      res = await fetch(
        `${base}/planner/items?user_id=${encodeURIComponent(context.userId)}`,
        { cache: "no-store" },
      );
    } catch {
      return "Error: could not reach the planner right now.";
    }
    if (!res.ok) {
      return `Error retrieving plan (status ${res.status}).`;
    }
    const items = (await res.json()) as PlanItem[];
    if (!items.length) {
      return (
        "Your academic plan is currently empty. " +
        "Ask me to search for a subject — like 'machine learning' or 'calculus' — " +
        "and I can help you find courses to save."
      );
    }
    const order = ["in_progress", "planned", "interested", "completed"];
    const labels: Record<string, string> = {
      interested: "Interested",
      planned: "Planned",
      in_progress: "In Progress",
      completed: "Completed ✓",
    };
    const byStatus: Record<string, PlanItem[]> = {};
    for (const item of items) {
      (byStatus[item.status] ??= []).push(item);
    }
    const sections = order
      .filter((s) => byStatus[s]?.length)
      .map((s) => {
        const courseLines = byStatus[s].map(
          (i) => `  • ${i.course_number} — ${i.course_title}`,
        );
        return `**${labels[s] ?? s}** (${byStatus[s].length}):\n${courseLines.join("\n")}`;
      });
    return `Your academic plan (${items.length} course${items.length === 1 ? "" : "s"}):\n\n${sections.join("\n\n")}`;
  }

  if (toolName === "get_aspirational_transcript") {
    if (!context.userId) {
      return (
        "The student needs to be signed in to view their transcript. " +
        "Please sign in at thevrschool.org, then ask again."
      );
    }
    let res: Response;
    try {
      res = await fetch(
        `${base}/planner/transcript?user_id=${encodeURIComponent(context.userId)}`,
        { cache: "no-store" },
      );
    } catch {
      return "Error: could not reach the transcript service right now. Please visit thevrschool.org/transcript directly.";
    }
    if (!res.ok) {
      return `Error retrieving transcript (status ${res.status}).`;
    }
    const data = (await res.json()) as TranscriptResponse;
    if (data.total_courses === 0) {
      return (
        "Your aspirational transcript is empty — no courses saved yet. " +
        "Search for a subject (like 'calculus' or 'algorithms') and I can help you add courses to your plan."
      );
    }
    const sections = data.sections.map((s) => {
      const approvedCourses = s.courses.filter((c) => c.school_approved);
      const lines = s.courses.map(
        (c) =>
          `  • ${c.course_number} — ${c.course_title}` +
          (c.school_approved ? " ★" : "") +
          ` | ${c.department}`,
      );
      return (
        `**${s.label}** (${s.courses.length}${approvedCourses.length ? `, ${approvedCourses.length} VR School approved` : ""}):\n` +
        lines.join("\n")
      );
    });
    return (
      `Aspirational Transcript — ${data.total_courses} course${data.total_courses !== 1 ? "s" : ""}, ` +
      `${data.approved_count} VR School approved (★):\n\n` +
      sections.join("\n\n") +
      "\n\nView the full printable version at thevrschool.org/transcript"
    );
  }

  return `Unknown tool: ${toolName}`;
}

// ── System prompt ─────────────────────────────────────────────────────────────

const PERSONA = `\
You are SofAI, the academic planning assistant for The VR School (thevrschool.org),
a WASC-accredited K-12 institution. Your mission is to help students discover
MIT OpenCourseWare (MIT OCW) courses, explore academic subjects across every
discipline, and build a meaningful learning plan — all for free.

# About The VR School
- WASC-accredited K-12 school focused on technology-forward, personalized education.
- Website: https://thevrschool.org | Catalog: https://thevrschool.org/catalog
- Director: Dr. Freedom Cheteni.
- Students can explore 2,500+ free MIT OpenCourseWare courses to supplement coursework,
  prepare for college, or pursue independent academic interests.

# About the MIT OCW Catalog
- Free, openly licensed content: © MIT OpenCourseWare, CC BY-NC-SA 4.0.
- 2,500+ courses spanning Computer Science, Mathematics, Physics, Chemistry, Biology,
  Electrical Engineering, Economics, Architecture, Philosophy, History, and more.
- Each course includes lecture notes; many include videos, problem sets, and exams.
- Students browse and search at thevrschool.org/catalog and track courses in their
  Academic Plan at thevrschool.org/planner.
- **VR School Approved (★)**: The VR School has curated and endorsed a set of MIT OCW
  courses that align with its K–12 curriculum. These appear with a "VR School" badge in
  the catalog and a ★ in the transcript. Students are encouraged to prioritize these.

# Aspirational Transcript (ibuildme.cv)
- Students can view their academic plan as a printable Aspirational Transcript at
  thevrschool.org/transcript.
- The transcript shows all saved courses organized by status, highlights VR School-approved
  courses, and is formatted for ibuildme.cv — a student CV builder.
- This is NOT an official academic credential; it documents independent study goals and
  enrichment coursework alongside formal schooling.

# Your Capabilities
1. **Search courses** — call \`search_mit_courses\` whenever the student mentions a
   subject, topic, instructor, or course number. Always show the course URL.
   VR School-approved courses are marked ★.
2. **Save courses** — call \`add_course_to_plan\` only when the student explicitly asks
   to save/add a specific course. Confirm: "I've added [title] to your plan."
3. **View plan** — call \`get_academic_plan\` when the student asks to see their
   saved courses or academic progress.
4. **View transcript** — call \`get_aspirational_transcript\` when the student asks about
   their transcript, CV, academic record, or which courses are school-approved.
5. **Recommend paths** — suggest logical academic sequences based on your knowledge:
   e.g. "Single Variable Calculus → Multivariable → Differential Equations" for math,
   or "Introduction to CS → Algorithms → Systems" for CS. Always prioritize VR School
   approved courses when recommending.
6. **Explain content** — describe what a course covers and whether it suits the student's
   goals, grade level, or interests.

# Showing Search Results
Format each result clearly:
  **6.006 — Introduction to Algorithms** (Undergraduate)
  Dept: Electrical Engineering and Computer Science | 📹 Video · 📝 Assignments
  https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/
  Covers sorting, searching, dynamic programming, and graph algorithms.

Always include the URL. Always remind students that MIT OCW is free.

# Style
- Warm, encouraging, academically focused. 3–4 sentences per turn unless the student
  asks for more detail.
- Address the student by name once you know it.
- When recommending prerequisites, be specific: "I'd suggest taking 18.01 (Single
  Variable Calculus) before 18.03 (Differential Equations)."
- For questions about official enrollment, dual enrollment, A–G requirements, or
  transcripts: "For anything official, please speak with your VR School counselor or
  contact us at thevrschool.org."

# What You Are
You are SofAI, The VR School's AI academic advisor. You are honest about being an AI.
You were built to help VR School students navigate MIT OpenCourseWare and build strong
academic plans. You do not replace human counselors — you help students explore.
`;

async function fetchCatalogContext(): Promise<string> {
  const base = getApiBaseUrl();
  try {
    const [syncRes, deptRes] = await Promise.all([
      fetch(`${base}/catalog/sync/status`, {
        next: { revalidate: 300 },
      } as RequestInit),
      fetch(`${base}/catalog/departments`, {
        next: { revalidate: 3600 },
      } as RequestInit),
    ]);
    const lines: string[] = [];
    if (syncRes.ok) {
      const sync = (await syncRes.json()) as { total_courses_in_db?: number };
      if (sync.total_courses_in_db) {
        lines.push(
          `MIT OCW courses currently in catalog: ${sync.total_courses_in_db.toLocaleString()}.`,
        );
      }
    }
    if (deptRes.ok) {
      const depts = (await deptRes.json()) as string[];
      if (depts.length > 0) {
        const shown = depts.slice(0, 20);
        lines.push(
          `Available departments (${depts.length} total): ${shown.join(", ")}${depts.length > 20 ? ", and more" : ""}.`,
        );
      }
    }
    if (!lines.length) return "";
    return `\n\n# Live catalog snapshot\n${lines.join("\n")}\n`;
  } catch {
    return "";
  }
}

async function fetchActiveMentorNotes(slug: string): Promise<string> {
  const base = getApiBaseUrl();
  try {
    const res = await fetch(`${base}/embed/${slug}/mentor-notes/active`, {
      next: { revalidate: 300 },
    } as RequestInit);
    if (!res.ok) return "";
    const data = (await res.json()) as {
      items?: { applied_text?: string }[];
    };
    const lines = (data.items ?? [])
      .map((n) => n.applied_text?.trim())
      .filter((t): t is string => Boolean(t));
    if (!lines.length) return "";
    return (
      `\n\n# Guidance from VR School instructors\n` +
      lines.map((t, i) => `${i + 1}. ${t}`).join("\n") +
      `\n`
    );
  } catch {
    return "";
  }
}

export async function buildSystemPrompt(slug: string = "sofai-vr"): Promise<string> {
  const [catalog, mentor] = await Promise.all([
    fetchCatalogContext(),
    fetchActiveMentorNotes(slug),
  ]);
  return PERSONA + catalog + mentor;
}

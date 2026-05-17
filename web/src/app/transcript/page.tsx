import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Nav } from "@/components/Nav";
import { TranscriptView } from "./TranscriptView";
import { getApiBaseUrl } from "@/lib/apiBase";

export const metadata = {
  title: "Aspirational Transcript | The VR School",
  description:
    "Your aspirational academic transcript — MIT OpenCourseWare courses curated and approved by The VR School.",
};

interface TranscriptEntry {
  plan_item_id: number;
  course_id: number;
  course_number: string;
  course_title: string;
  course_url: string;
  department: string;
  level: string;
  source: string;
  school_approved: boolean;
  status: string;
  notes: string;
  added_at: string;
}

interface TranscriptSection {
  status: string;
  label: string;
  courses: TranscriptEntry[];
}

export interface TranscriptData {
  user_id: string;
  generated_at: string;
  school_name: string;
  school_url: string;
  total_courses: number;
  approved_count: number;
  sections: TranscriptSection[];
}

async function fetchTranscript(userId: string): Promise<TranscriptData | null> {
  try {
    const res = await fetch(
      `${getApiBaseUrl()}/planner/transcript?user_id=${encodeURIComponent(userId)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    return (await res.json()) as TranscriptData;
  } catch {
    return null;
  }
}

export default async function TranscriptPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/signin?next=/transcript");
  }
  const userId = (session.user as { id?: string }).id ?? session.user.email ?? "";
  const studentName = session.user.name ?? session.user.email ?? "Student";
  const transcript = await fetchTranscript(userId);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <TranscriptView
          transcript={transcript}
          studentName={studentName}
          userId={userId}
        />
      </main>
    </>
  );
}

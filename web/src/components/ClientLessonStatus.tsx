"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { isLessonComplete, readProgress } from "@/lib/progress";

export function ClientLessonStatus({
  programSlug,
  lessonSlug,
}: {
  programSlug: string;
  lessonSlug: string;
}) {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const state = readProgress();
    setDone(isLessonComplete(state, programSlug, lessonSlug));
  }, [programSlug, lessonSlug]);

  return done ? (
    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
  ) : (
    <Circle className="h-5 w-5 text-zinc-600" />
  );
}

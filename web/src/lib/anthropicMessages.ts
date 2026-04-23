/**
 * Normalize a chat transcript so it's safe to send to the Anthropic Messages
 * API. Anthropic requires:
 *   1. The first message has role "user".
 *   2. Roles alternate user/assistant/user/... (no two consecutive same-role
 *      messages).
 *   3. No empty messages.
 *
 * Client components on sof.ai (AgentChat, TutorChat, RoomChat,
 * LessonDiscussion) all construct transcripts in different ways:
 *   - They seed with a synthetic assistant greeting for UX.
 *   - Multi-agent rooms remap other agents' turns to role "user" so the
 *     current agent sees a transcript of what was said by whom, which
 *     can produce consecutive user messages.
 *   - Lesson discussion threads mix human + multi-agent posts.
 * Without normalization, every one of these paths can send an array that
 * Anthropic rejects with a 400, breaking the feature.
 *
 * This helper is the one place that enforces the contract, so every caller
 * is covered by one defense.
 */

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

export function sanitizeForAnthropic(
  messages: { role: "user" | "assistant"; content: string }[],
): AnthropicMessage[] {
  // 1. Drop empty content.
  const nonEmpty = messages
    .filter((m) => m.content.trim().length > 0)
    .map((m) => ({ role: m.role, content: m.content }));

  // 2. Strip leading assistant messages (e.g. synthetic greetings).
  const firstUserIdx = nonEmpty.findIndex((m) => m.role === "user");
  if (firstUserIdx < 0) return [];
  const trimmed = firstUserIdx > 0 ? nonEmpty.slice(firstUserIdx) : nonEmpty;

  // 3. Merge consecutive same-role messages with a newline separator.
  const merged: AnthropicMessage[] = [];
  for (const m of trimmed) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) {
      last.content = `${last.content}\n${m.content}`;
    } else {
      merged.push({ role: m.role, content: m.content });
    }
  }

  return merged;
}

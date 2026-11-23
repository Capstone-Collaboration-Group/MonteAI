import type { AvatarEmotion } from "./types";

// Match an unsuccessful reply, not negative words in a thesis's findings.
// Keep these anchored to the opening so a helpful capability reply that later
// explains a limitation ("I can't ...") still gets a friendly expression.
const UNSUCCESSFUL_OPENINGS = [
  /^(?:there (?:are|were) )?no (?:relevant |matching )?(?:theses|studies|papers|sources|results|matches)\b/i,
  /^(?:i|we) (?:can't|cannot|couldn't|could not|didn't|did not) (?:find|locate|help|assist|answer|perform|provide|generate)\b/i,
  /^(?:i(?:'m| am)|we(?:'re| are)) (?:unable|not able) to (?:find|locate|help|assist|answer|perform|provide|generate)\b/i,
  /^(?:the )?(?:retrieved|available) (?:theses|studies|sources) (?:do not|don't) (?:explicitly |directly )?(?:address|answer|cover)\b/i,
  /^(?:something went wrong|(?:the )?(?:request|search|response) failed|could not (?:load|generate))\b/i,
];

/**
 * Shared web/native reply mood. Citations are evidence, not sentiment: a
 * greeting, introduction, clarification, or capability answer can be cheerful
 * without any sources. Empty drafts stay neutral; explicit unsuccessful
 * replies are sad. Transport errors are handled by the chat screens.
 */
export function getAvatarEmotion(content?: string | null): AvatarEmotion {
  const text = (content ?? "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[*_`#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "neutral";

  // Allow a brief greeting/apology before an otherwise unsuccessful reply.
  const opening = text
    .replace(/^(?:hi|hello|hey)(?: there)?[\s!,.:\u2013\u2014-]+/i, "")
    .replace(/^(?:(?:i(?:'m| am) )?sorry|unfortunately)[\s!,.:\u2013\u2014-]+(?:but )?/i, "")
    .trim();

  return UNSUCCESSFUL_OPENINGS.some((pattern) => pattern.test(opening)) ? "sad" : "cheerful";
}

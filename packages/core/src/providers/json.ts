/** Extract the first JSON object/array from an LLM response (tolerates code fences). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1]! : text).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.search(/[[{]/);
    const endObj = candidate.lastIndexOf("}");
    const endArr = candidate.lastIndexOf("]");
    const end = Math.max(endObj, endArr);
    if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1));
    throw new Error("Model response did not contain JSON");
  }
}

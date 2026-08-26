import { openai, AI_MODEL, isAiEnabled } from "./client"
import { SYSTEM_PROMPT, buildInterpretationPrompt } from "./prompts"
import {
  InterpretationSchema,
  InterpretationJsonSchema,
  type Interpretation,
} from "./schemas"

export type InterpretationResult =
  | { ok: true; data: Interpretation }
  | { ok: false; error: string; disabled?: boolean }

export async function interpretInput(
  rawInput: string
): Promise<InterpretationResult> {
  if (!isAiEnabled()) {
    return { ok: false, error: "AI not configured", disabled: true }
  }

  const trimmed = rawInput.trim()
  if (trimmed.length < 3) {
    return { ok: false, error: "Input too short to interpret" }
  }

  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      temperature: 0,
      response_format: {
        type: "json_schema",
        json_schema: InterpretationJsonSchema,
      },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildInterpretationPrompt(trimmed) },
      ],
    })

    const raw = response.choices[0]?.message?.content
    if (!raw) return { ok: false, error: "Empty response from AI" }

    const parsed = JSON.parse(raw)
    const validated = InterpretationSchema.safeParse(parsed)

    if (!validated.success) {
      console.error("[VECTOR AI] Schema validation failed:", validated.error)
      return { ok: false, error: "AI response did not match expected schema" }
    }

    return { ok: true, data: validated.data }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown AI error"
    console.error("[VECTOR AI] Interpretation failed:", message)
    return { ok: false, error: message }
  }
}

import OpenAI from "openai"

if (!process.env.OPENAI_API_KEY) {
  console.warn("[VECTOR AI] OPENAI_API_KEY not set — AI features will be disabled")
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "missing",
})

export const AI_MODEL = "gpt-4o-mini"

export function isAiEnabled(): boolean {
  return !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "missing"
}

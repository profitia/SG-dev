/** Assistant appearance only. No inference of user gender or access rights. */
export type AssistantAvatar = 'male' | 'female' | 'neutral';
export function normalizeAssistantAvatar(value: unknown): AssistantAvatar {
  return value === 'male' || value === 'female' ? value : 'neutral';
}

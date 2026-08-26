import { z } from "zod"

export const EtapSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(200),
  order: z.number().int().min(0),
  projectId: z.string(),
})

export const SubetapSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(200),
  order: z.number().int().min(0),
  etapId: z.string(),
})

export const EtapWithSubetapsSchema = EtapSchema.extend({
  subetaps: z.array(SubetapSchema),
})

export type Etap = z.infer<typeof EtapSchema>
export type Subetap = z.infer<typeof SubetapSchema>
export type EtapWithSubetaps = z.infer<typeof EtapWithSubetapsSchema>

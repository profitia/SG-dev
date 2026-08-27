import fs from "fs"
import path from "path"
import { randomUUID } from "crypto"

export interface AtomicFileWrite {
  filePath: string
  content: string
}

interface AtomicWriteJournal {
  operationId: string
  label: string
  status: "STARTED" | "STAGED" | "COMMITTED" | "ROLLED_BACK"
  createdAt: string
  updatedAt: string
  targets: string[]
  error: string | null
}

interface AtomicWriteOptions {
  label?: string
  journalPath?: string
}

interface JsonReadResult<T> {
  value: T | null
  error: string | null
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function jsonText(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

function createTempPath(targetPath: string): string {
  const dir = path.dirname(targetPath)
  const base = path.basename(targetPath)
  return path.join(dir, `.${base}.pmos-tmp-${process.pid}-${Date.now()}-${randomUUID()}`)
}

function writeJournal(filePath: string, journal: AtomicWriteJournal): void {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, jsonText(journal), "utf-8")
}

function cleanupFile(filePath: string): void {
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
}

export function atomicWriteFileSet(writes: AtomicFileWrite[], options: AtomicWriteOptions = {}): void {
  if (writes.length === 0) return
  const uniqueWrites = new Map<string, AtomicFileWrite>()
  for (const write of writes) {
    uniqueWrites.set(path.resolve(write.filePath), { filePath: path.resolve(write.filePath), content: write.content })
  }

  const operationId = randomUUID()
  const label = options.label ?? "pmos-atomic-write"
  const journalPath = options.journalPath ? path.resolve(options.journalPath) : null
  const targets = Array.from(uniqueWrites.keys())
  const backups = new Map<string, string | null>()
  const tempPaths = new Map<string, string>()
  const committedTargets: string[] = []

  const writeStage = (status: AtomicWriteJournal["status"], error: string | null = null) => {
    if (!journalPath) return
    writeJournal(journalPath, {
      operationId,
      label,
      status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      targets,
      error,
    })
  }

  writeStage("STARTED")
  try {
    for (const [targetPath, write] of uniqueWrites) {
      ensureDir(path.dirname(targetPath))
      backups.set(targetPath, fs.existsSync(targetPath) ? fs.readFileSync(targetPath, "utf-8") : null)
      const tempPath = createTempPath(targetPath)
      fs.writeFileSync(tempPath, write.content, "utf-8")
      tempPaths.set(targetPath, tempPath)
    }

    writeStage("STAGED")

    for (const targetPath of targets) {
      const tempPath = tempPaths.get(targetPath)
      if (!tempPath) throw new Error(`Missing staged file for ${targetPath}`)
      fs.renameSync(tempPath, targetPath)
      committedTargets.push(targetPath)
      tempPaths.delete(targetPath)
    }

    if (journalPath) {
      writeStage("COMMITTED")
      cleanupFile(journalPath)
    }
  } catch (error) {
    for (const targetPath of [...committedTargets].reverse()) {
      const backup = backups.get(targetPath) ?? null
      if (backup === null) {
        cleanupFile(targetPath)
        continue
      }
      const restoreTemp = createTempPath(targetPath)
      fs.writeFileSync(restoreTemp, backup, "utf-8")
      fs.renameSync(restoreTemp, targetPath)
    }

    for (const tempPath of tempPaths.values()) cleanupFile(tempPath)
    writeStage("ROLLED_BACK", (error as Error).message)
    throw error
  }
}

export function atomicWriteTextFile(filePath: string, content: string, options: AtomicWriteOptions = {}): void {
  atomicWriteFileSet([{ filePath, content }], options)
}

export function atomicWriteJsonFile(filePath: string, value: unknown, options: AtomicWriteOptions = {}): void {
  atomicWriteTextFile(filePath, jsonText(value), options)
}

export function atomicCopyFile(sourcePath: string, targetPath: string, options: AtomicWriteOptions = {}): void {
  const content = fs.readFileSync(sourcePath, "utf-8")
  atomicWriteTextFile(targetPath, content, options)
}

export function quarantineTextArtifact(filePath: string, quarantineDir: string, label: string): string | null {
  if (!fs.existsSync(filePath)) return null
  ensureDir(quarantineDir)
  const ext = path.extname(filePath)
  const base = path.basename(filePath, ext)
  const targetPath = path.join(quarantineDir, `${base}__${label}__${new Date().toISOString().replace(/[:.]/g, "-")}${ext || ".txt"}`)
  atomicCopyFile(filePath, targetPath, { label: `quarantine:${path.basename(filePath)}` })
  return targetPath
}

export function readJsonFileSafe<T>(filePath: string): JsonReadResult<T> {
  try {
    const raw = fs.readFileSync(filePath, "utf-8")
    return { value: JSON.parse(raw) as T, error: null }
  } catch (error) {
    return { value: null, error: (error as Error).message }
  }
}
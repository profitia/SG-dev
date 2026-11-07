import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

/** The existing workspace PMOS lock, shared by save and recovery. */
export function acquirePmosLock(file: string, conversationId: string): () => void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const token = randomUUID()
  for (;;) {
    let fd: number
    try { fd = fs.openSync(file, 'wx', 0o600) } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      const raw = fs.readFileSync(file, 'utf8')
      let previous: { pid?: number; hostname?: string }
      try { previous = JSON.parse(raw) } catch { throw new Error('PMOS lock is malformed; preserve it for operator reconciliation.') }
      if (previous.hostname !== os.hostname() || !Number.isInteger(previous.pid)) throw new Error('PMOS lock ownership cannot be established.')
      try { process.kill(previous.pid!, 0) } catch (probe) {
        if ((probe as NodeJS.ErrnoException).code === 'ESRCH') {
          // Never reclaim a live writer merely because a publication took >60s.
          if (fs.readFileSync(file, 'utf8') === raw) fs.unlinkSync(file)
          continue
        }
      }
      throw new Error('PMOS advisory lock held by another live writer.')
    }
    try {
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, hostname: os.hostname(), startedAt: new Date().toISOString(), conversationId, token }, null, 2))
    } finally { fs.closeSync(fd) }
    return () => {
      if (!fs.existsSync(file)) return
      const current = JSON.parse(fs.readFileSync(file, 'utf8')) as { token?: string }
      if (current.token !== token) throw new Error('Refusing to release another PMOS writer\'s lock.')
      fs.unlinkSync(file)
    }
  }
}

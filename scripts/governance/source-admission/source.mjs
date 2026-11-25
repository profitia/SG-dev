import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

export class GateError extends Error {
  constructor(code, { hold = false } = {}) {
    super(code)
    this.code = code
    this.status = hold ? 'HOLD' : 'FAIL'
  }
}

export function requireThat(condition, code, options) {
  if (!condition) throw new GateError(code, options)
}

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
export const isOid = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value)

export function canonical(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' ||
      Number.isSafeInteger(value)) return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  requireThat(value && Object.getPrototypeOf(value) === Object.prototype, 'INVALID_CANONICAL_VALUE')
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}'
}

export function gitReader(directory) {
  const env = {
    PATH: process.env.PATH, LANG: 'C', GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null', GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0',
  }
  function run(...args) {
    try {
      return execFileSync('git', ['--no-replace-objects', '-C', directory, ...args], {
        env, timeout: 8_000, maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch {
      throw new GateError('GIT_DATA_UNAVAILABLE', { hold: true })
    }
  }

  function commit(oid) {
    requireThat(isOid(oid), 'INVALID_COMMIT')
    const headers = run('cat-file', 'commit', oid).toString('utf8').split('\n\n', 1)[0].split('\n')
    const tree = headers.find(header => header.startsWith('tree '))?.slice(5)
    const parents = headers.filter(header => header.startsWith('parent ')).map(header => header.slice(7))
    requireThat(isOid(tree) && parents.every(isOid), 'GIT_COMMIT_INVALID')
    return { tree, parents }
  }

  function blob(oid, mode) {
    if (mode === '000000') {
      requireThat(oid === '0'.repeat(40), 'INVALID_MISSING_BLOB')
      return null
    }
    requireThat(['100644', '100755'].includes(mode) && isOid(oid), 'UNSUPPORTED_GIT_ENTRY')
    const bytes = run('cat-file', 'blob', oid)
    const rebuilt = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex')
    requireThat(rebuilt === oid, 'BLOB_BYTES_DO_NOT_MATCH')
    return { oid, mode, sha256: sha256(bytes) }
  }

  function delta(from, to) {
    requireThat(isOid(from) && isOid(to), 'INVALID_DIFF_RANGE')
    const raw = run('diff-tree', '-r', '--raw', '--no-commit-id', '--no-renames', '--no-ext-diff', '-z', from, to)
    const fields = new TextDecoder('utf8', { fatal: true }).decode(raw).split('\0')
    requireThat(fields.pop() === '' && fields.length % 2 === 0, 'INVALID_DIFF')
    const files = []
    for (let i = 0; i < fields.length; i += 2) {
      const meta = /^:(\d{6}) (\d{6}) ([a-f0-9]{40}) ([a-f0-9]{40}) ([AMD])$/.exec(fields[i])
      const path = fields[i + 1]
      requireThat(meta && /^[A-Za-z0-9._/@+ -]+$/.test(path) &&
        path.split('/').every(part => part && part !== '.' && part !== '..'), 'UNSUPPORTED_DIFF_ENTRY')
      const [, oldMode, newMode, oldOid, newOid, change] = meta
      files.push({ path, change, before: blob(oldOid, oldMode), after: blob(newOid, newMode) })
    }
    return files
  }

  function commonBase(main, head) {
    requireThat(isOid(main) && isOid(head), 'INVALID_DIFF_RANGE')
    const candidates = run('merge-base', '--all', main, head).toString('utf8').trim().split('\n')
    requireThat(candidates.length === 1 && isOid(candidates[0]), 'MERGE_BASE_NOT_UNIQUE', { hold: true })
    return candidates[0]
  }

  function entry(ref, path) {
    requireThat(isOid(ref) && typeof path === 'string' && /^[A-Za-z0-9._/+-]+$/.test(path),
      'INVALID_GIT_ENTRY_QUERY')
    const line = run('ls-tree', '--full-tree', ref, '--', path).toString('utf8').trimEnd()
    if (!line) return null
    const match = /^(\d{6}) blob ([a-f0-9]{40})\t(.+)$/.exec(line)
    requireThat(match && match[3] === path, 'UNSUPPORTED_GIT_ENTRY')
    return blob(match[2], match[1])
  }

  return { commit, delta, commonBase, entry }
}

const protectedPath = /^(?:\.github\/|\.devcontainer\/|Canon\/|scripts\/governance\/|packages\/governance\/|docs\/agent-instructions\/|apps\/architecture-lab\/current-sdk-source\.json$|AGENTS\.md$)/

export function inspectSource(snapshot, git, policy) {
  const { repo, pr, main, mergeBase, testMerge } = snapshot
  requireThat(repo.id === policy.repoId && repo.full_name === policy.repository &&
    repo.owner.id === policy.repoOwnerId && pr.head.repo?.id === repo.id &&
    pr.base.repo?.id === repo.id && pr.base.ref === 'main', 'REPOSITORY_OR_REF_MISMATCH')
  requireThat(pr.state === 'open' && !pr.merged && Number.isSafeInteger(pr.number) &&
    pr.number > 0 && isOid(pr.head.sha) && isOid(main) && isOid(mergeBase), 'PR_SOURCE_UNAVAILABLE', { hold: true })
  requireThat(git.commonBase(main, pr.head.sha) === mergeBase, 'MERGE_BASE_DISAGREES', { hold: true })
  const files = git.delta(mergeBase, pr.head.sha)
  requireThat(files.length > 0, 'EMPTY_SOURCE')
  const owners = files.map(({ path }) => policy.resolveRoute(path))
  requireThat(owners.every(route => route?.baselineClassification === 'ALIGNED' && route.currentOwner),
    'ROUTING_NOT_PROVEN', { hold: true })
  const risk = files.some(({ path }, index) => protectedPath.test(path) ||
    owners[index].currentOwner === 'Governance Source Layer') ? 'R4'
    : files.every(({ path, change, before, after }, index) =>
      Object.hasOwn(policy.r1Paths, path) && policy.r1Paths[path] === owners[index].currentOwner &&
      change === 'M' && before?.mode === '100644' && after?.mode === '100644') ? 'R1' : 'CONTROLLED'
  const scopedFiles = files.map((file, index) => ({ ...file, owner: owners[index].currentOwner }))

  requireThat(testMerge && isOid(testMerge.sha) && testMerge.sha === pr.merge_commit_sha,
    'TEST_MERGE_UNAVAILABLE', { hold: true })
  const observedMerge = git.commit(testMerge.sha)
  requireThat(observedMerge.tree === testMerge.tree && canonical(observedMerge.parents) === canonical(testMerge.parents),
    'GIT_AND_GITHUB_TREE_DISAGREE')
  requireThat(canonical(observedMerge.parents) === canonical([main, pr.head.sha]),
    'INTEGRATION_PARENTS_STALE', { hold: true })
  requireThat(canonical(git.delta(main, testMerge.sha)) === canonical(files),
    'INTEGRATION_DELTA_MISMATCH', { hold: true })

  return {
    repository: repo.full_name, repoId: repo.id, repoOwnerId: repo.owner.id, pr: pr.number,
    target: 'refs/heads/main', head: pr.head.sha, mergeBase, main, testMerge: testMerge.sha,
    integrationTree: observedMerge.tree, files: scopedFiles,
    sourceDigest: sha256(canonical(scopedFiles)), risk, draft: pr.draft !== false,
  }
}

export async function readGitHubSnapshot(get, repository, number) {
  requireThat(/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(repository) &&
    Number.isSafeInteger(number) && number > 0, 'INVALID_OBSERVATION_TARGET')
  const api = '/repos/' + repository
  const readMain = async () => (await get(api + '/git/ref/heads/main')).object.sha
  const readPr = () => get(api + '/pulls/' + number)
  try {
    const [repo, main, pr] = await Promise.all([get(api), readMain(), readPr()])
    requireThat(isOid(main) && isOid(pr.head?.sha) && pr.number === number, 'GITHUB_SNAPSHOT_INVALID')
    const comparison = await get(api + '/compare/' + main + '...' + pr.head.sha)
    const mergeBase = comparison.merge_base_commit.sha
    const merge = isOid(pr.merge_commit_sha) ? await get(api + '/git/commits/' + pr.merge_commit_sha) : null
    const testMerge = merge && { sha: merge.sha, tree: merge.tree.sha, parents: merge.parents.map(p => p.sha) }
    const [endMain, endPr] = await Promise.all([readMain(), readPr()])
    requireThat(endMain === main && endPr.head.sha === pr.head.sha && endPr.base.ref === pr.base.ref &&
      endPr.base.repo.id === pr.base.repo.id && endPr.head.repo?.id === pr.head.repo?.id &&
      endPr.state === pr.state && endPr.merged === pr.merged && endPr.draft === pr.draft &&
      endPr.merge_commit_sha === pr.merge_commit_sha, 'GITHUB_SNAPSHOT_MOVED', { hold: true })
    return { repo, main, pr, mergeBase, testMerge }
  } catch (error) {
    if (error instanceof GateError) throw error
    throw new GateError('GITHUB_READ_UNAVAILABLE', { hold: true })
  }
}

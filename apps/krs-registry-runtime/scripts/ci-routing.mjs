import assert from 'node:assert/strict'
import {normalizeRepositorySlug,resolveProjectProfile} from '../../../scripts/governance/project-profile.mjs'
import {resolveProjectRouting} from '../../../scripts/governance/routing-engine.mjs'

// These are owner decisions, not a search for any profile that permits a path.
const sharedOwners = new Map([['Maps Capability', 'SRM'], ['Governance Source Layer', 'ARCHITECTURE']])

export function projectForRoute(route) {
  assert.equal(route.resolutionStatus, 'RESOLVED', 'Every changed path needs an unambiguous owner')
  assert.equal(route.baselineClassification, 'ALIGNED', 'Legacy changes require separate explicit approval')
  assert.equal(route.highestSpecificityMatchCount, 1, 'Conflicting ownership is denied')
  const keys = route.allowedProjectKeys
  assert(Array.isArray(keys) && keys.length && new Set(keys).size === keys.length, 'Explicit project boundary required')
  const project = sharedOwners.get(route.currentOwner) ?? (keys.length === 1 ? keys[0] : null)
  assert(project && keys.includes(project), 'Ambiguous owner profile is denied')
  return project
}

export function partitionChangedPaths(changedPaths, repositoryRoot) {
  assert(Array.isArray(changedPaths) && changedPaths.length, 'All changed paths are required')
  assert.equal(new Set(changedPaths).size, changedPaths.length, 'Duplicate targets are denied')
  for (const target of changedPaths) {
    assert(typeof target === 'string' && target.length && target === target.trim()
      && !target.startsWith('/') && !target.includes('\\') && !/[\x00-\x1f\x7f]/.test(target)
      && target.split('/').every(part => part && part !== '.' && part !== '..'), 'Exact repository-relative path required')
  }
  const routed = resolveProjectRouting({profile: resolveProjectProfile('ARCHITECTURE', repositoryRoot), targets: changedPaths, repositoryRoot})
  assert.equal(routed.results.length, changedPaths.length, 'Canonical routing must cover every path')
  const groups = new Map(), partition = []
  for (const [index, route] of routed.results.entries()) {
    assert.equal(route.normalizedPath, changedPaths[index], 'Routing cannot rewrite a changed path')
    const projectKey = projectForRoute(route)
    const actual = resolveProjectRouting({profile: resolveProjectProfile(projectKey, repositoryRoot), targets: [route.normalizedPath], repositoryRoot})
    assert(actual.ok && actual.results[0].projectBoundaryStatus === 'ALLOWED', 'Actual owner routing must pass')
    const group = groups.get(projectKey) ?? []
    group.push(route.normalizedPath); groups.set(projectKey, group)
    partition.push({path: route.normalizedPath, projectKey, owner: route.currentOwner, surfaceId: route.matchedSurfaceId, codeState: route.baselineClassification})
  }
  return {groups: [...groups].map(([projectKey, targets]) => ({projectKey, targets})), partition}
}

export function validateCandidate({git, candidate, base}) {
  const head = git(['rev-parse', 'HEAD'])
  assert(/^[a-f0-9]{40}$/.test(candidate) && head === candidate, 'Proof must validate exact candidate HEAD')
  assert(/^[a-f0-9]{40}$/.test(base) && base !== head, 'Exact distinct validation base required')
  assert.equal(git(['rev-parse', '--verify', `${base}^{commit}`]), base, 'Exact validation base must exist')
  git(['merge-base', '--is-ancestor', base, head])
  return head
}

export function validateOwnerGroups({groups, runGovernance}) {
  return groups.map(({projectKey, targets}) => {
    const governance = runGovernance(projectKey, targets)
    assert.equal(governance.verdict, 'PASS', `Canonical ${projectKey} governance failed`)
    return {projectKey, targets, governance}
  })
}


// Artifact provenance remains the exact source head. A fresh PR merge is a
// separate authority context, never a replacement source or a fabricated ref.
export function validateGovernanceContext({sourceGit,contextGit,candidate,validationSha,requestedBase,event,changedPaths}) {
  assert.equal(sourceGit(['rev-parse','HEAD']),candidate,'Exact artifact source required')
  assert(/^[a-f0-9]{40}$/.test(validationSha??''),'Exact validation revision required')
  assert.equal(contextGit(['rev-parse','HEAD']),validationSha,'Actual validation checkout required')
  for(const git of [sourceGit,contextGit]) {
    assert.equal(normalizeRepositorySlug(git(['remote','get-url','origin'])),'profitia/sg-dev','Canonical repository required')
    assert.equal(git(['status','--porcelain','--untracked-files=all']),'','Clean independent checkout required')
  }
  assert(/^[a-f0-9]{40}$/.test(requestedBase??''),'Exact event base required')
  let base=requestedBase
  if(event==='pull_request') {
    const parents=contextGit(['rev-list','--parents','-n','1',validationSha]).split(' ')
    assert.equal(parents.length,3,'Actual two-parent GitHub validation merge required')
    assert.equal(parents[0],validationSha)
    assert.equal(parents[2],candidate,'Validation merge must include the exact artifact candidate')
    contextGit(['merge-base','--is-ancestor',requestedBase,parents[1]])
    base=parents[1]
  } else {
    assert.equal(event,'push','Only explicit source CI events are accepted')
    assert.equal(validationSha,candidate,'Push validates the actual pushed source')
    contextGit(['merge-base','--is-ancestor',base,validationSha])
  }
  assert(Array.isArray(changedPaths)&&changedPaths.length&&new Set(changedPaths).size===changedPaths.length,'Complete unique target list required')
  const actual=sourceGit(['diff','--name-only','--no-renames',requestedBase+'...'+candidate]).split('\n').filter(Boolean).sort()
  assert.deepEqual([...changedPaths].sort(),actual,'Complete exact source diff required')
  for(const target of changedPaths) {
    assert.equal(contextGit(['ls-tree','-z',validationSha,'--',target]),sourceGit(['ls-tree','-z',candidate,'--',target]),'Validation context must preserve candidate bytes and mode: '+target)
  }
  return {candidateHeadSha:candidate,validationSha,baseSha:base,requestedBaseSha:requestedBase}
}

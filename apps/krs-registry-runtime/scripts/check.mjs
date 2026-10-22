import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
for(const file of fs.readdirSync('src').filter(f=>f.endsWith('.ts'))){
 const source=fs.readFileSync(path.join('src',file),'utf8')
 assert.doesNotMatch(source,/apps\/(?:srm|maps-runtime|identity-runtime)|srm-xray|mgbi-financial|KRS_CONTINUITY_V1/)
 assert.doesNotMatch(source,/\bfetch\s*\(|https?\.request\s*\(|setInterval\s*\(|cron\b/)
 assert.doesNotMatch(source,/process\.env\.(?:DATABASE_URL|DIRECT_URL|NPM_TOKEN)/)
}
const workflow=fs.readFileSync('../../.github/workflows/krs-registry-ci.yml','utf8')
assert.doesNotMatch(workflow,/secrets\.|environment:|pull_request_target|workflow_run|workflow_dispatch|render deploy|neon (?:create|branch)|permissions:\s*write/)
assert.match(workflow,/contents: read/)
console.log('KRS source and no-activation boundary PASS')

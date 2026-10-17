import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import sharp from 'sharp'

test('host and Next use the patched native image package and preserve real SVG/PNG processing', async context => {
  const require = createRequire(import.meta.url)
  const fromNext = createRequire(require.resolve('next/package.json'))
  assert.equal(require.resolve('sharp'), fromNext.resolve('sharp'), 'A nested older binary must not shadow the host mitigation')
  // Native conditional ESM/CJS exports have distinct JS function identities.
  // Verify package resolution and real processing instead of reference identity.
  const implementations = [sharp, fromNext('sharp') as typeof sharp]
  for (const implementation of implementations) {
    const version = implementation.versions.sharp.match(/^(\d+)\.(\d+)\.(\d+)$/)
    assert(version, 'An explicit native release is required')
    const [major, minor, patch] = version.slice(1).map(Number)
    assert(major > 0 || minor > 35 || (minor === 35 && patch >= 5), 'Native image mitigation requires sharp >=0.35.5')
    const png = await implementation(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="blue"/></svg>')).png().toBuffer()
    const metadata = await implementation(png).metadata()
    assert.equal(metadata.format, 'png'); assert.equal(metadata.width, 8); assert.equal(metadata.height, 8)
  }
  context.diagnostic(JSON.stringify({ sharp: sharp.versions.sharp, vips: sharp.versions.vips, platform: process.platform, architecture: process.arch }))
})

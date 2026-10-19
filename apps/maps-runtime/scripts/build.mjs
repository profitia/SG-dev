import fs from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'

const root = fileURLToPath(new URL('../', import.meta.url)), dist = path.join(root, 'dist')
const replacements = {
  '@profitia/maps-contracts': '/modules/maps-contracts/index.mjs',
  '@profitia/maps-embed': '/modules/maps-embed/index.mjs',
  '@profitia/platform-contracts/embedded-read-channel': '/modules/platform-contracts/embedded-read-channel.mjs',
}
await fs.rm(dist, {recursive: true, force: true})
await fs.cp(path.join(root, 'public'), dist, {recursive: true})
const copyModule = async (source, output) => {
  execFileSync(process.execPath, ['--check', source])
  let content = await fs.readFile(source, 'utf8')
  for (const [from, to] of Object.entries(replacements)) content = content.replaceAll(`'${from}'`, `'${to}'`)
  await fs.mkdir(path.dirname(output), {recursive: true})
  await fs.writeFile(output, content)
}
for (const name of await fs.readdir(path.join(root, 'src/client'))) await copyModule(path.join(root, 'src/client', name), path.join(dist, 'client', name))
for (const [name, file] of [['maps-contracts', 'index.mjs'], ['maps-embed', 'index.mjs'], ['platform-contracts', 'src/embedded-read-channel.mjs'], ['platform-contracts', 'src/embedded-channel-core.mjs']]) {
  const entry = name === 'platform-contracts' ? import.meta.resolve('@profitia/platform-contracts/embedded-read-channel') : import.meta.resolve(`@profitia/${name}`)
  const source = name === 'platform-contracts' ? path.join(path.dirname(fileURLToPath(entry)), path.basename(file)) : fileURLToPath(entry)
  await copyModule(source, path.join(dist, 'modules', name, path.basename(file)))
}
const files = {}
async function hashDirectory(folder) {
  for (const item of (await fs.readdir(folder, {withFileTypes: true})).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    const full = path.join(folder, item.name)
    if (item.isDirectory()) await hashDirectory(full)
    else files[path.relative(dist, full)] = createHash('sha256').update(await fs.readFile(full)).digest('hex')
  }
}
await hashDirectory(dist)
for (const name of ['package.json', 'package-lock.json', 'src/server/config.mjs', 'src/server/server.mjs', 'src/server/google/geocoding.mjs']) files[`runtime/${name}`] = createHash('sha256').update(await fs.readFile(path.join(root, name))).digest('hex')
const digest = createHash('sha256').update(JSON.stringify(files)).digest('hex')
const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim()
await fs.writeFile(path.join(dist, 'build-manifest.json'), JSON.stringify({sourceSha, digest, files}, null, 2))
console.log(`Maps build: ${Object.keys(files).length} files; artifact sha256:${digest}; source ${sourceSha}`)

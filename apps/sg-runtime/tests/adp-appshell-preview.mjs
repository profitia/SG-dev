/** Public-only acceptance harness, never imported by the product. No real account
 * or business endpoints. Production resolves the normal declared file package.
 * The isolated harness resolves only the two public exports after byte binding. */
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import http from 'node:http'

export const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const publicRoot = path.resolve(appRoot, '../../packages/srm-adp-ui')
export const runtimeRequire = createRequire(process.env.APPSHELL_TEST_RUNTIME || path.join(appRoot, 'package.json'))
export function verifyPublicAdoption() {
  const read = name => JSON.parse(fs.readFileSync(name, 'utf8'))
  const receipt = read(path.join(appRoot, 'adp-integration.json')), source = read(path.join(publicRoot, 'source-contract.json'))
  const manifest = read(path.join(publicRoot, 'package.json')), consumer = read(path.join(appRoot, 'package.json'))
  if (consumer.dependencies[manifest.name] !== 'file:../../packages/srm-adp-ui' || manifest.name !== receipt.package || manifest.version !== receipt.packageVersion
    || receipt.contractVersion !== source.contractVersion || receipt.scope !== 'PRESENTATION_ONLY' || receipt.stateBoundary !== 'LOCAL_STATE') throw Error('Unaccepted public ADP binding')
  const walk = dir => fs.readdirSync(path.join(publicRoot, dir), {withFileTypes: true}).flatMap(e => {
    if (e.isSymbolicLink()) throw Error('Public source symlink refused')
    return e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]
  })
  const names = ['package.json', 'package-lock.json', 'tsconfig.json', ...walk('src')].sort(), hash = createHash('sha256')
  for (const name of names) hash.update(name).update('\0').update(fs.readFileSync(path.join(publicRoot, name))).update('\0')
  if (receipt.sourceDigest !== hash.digest('hex') || receipt.sourceDigest !== source.sourceDigest || JSON.stringify(names) !== JSON.stringify(source.sourceFiles)) throw Error('Public ADP source differs from accepted digest')
  return receipt
}

const testNavigation = `export const useRouter=()=>globalThis.__adpTestNavigation.router;
export const usePathname=()=>globalThis.__adpTestNavigation.pathname;
export const useSearchParams=()=>new URLSearchParams(globalThis.__adpTestNavigation.search||'');`
const previewNavigation = `import React from 'react';
const listen=f=>{window.addEventListener('popstate',f);return()=>window.removeEventListener('popstate',f)};
const notify=()=>window.dispatchEvent(new PopStateEvent('popstate'));
const router={push:(url,options)=>{history.pushState(null,'',url);notify();if(options?.scroll!==false)window.scrollTo(0,0)},replace:url=>{history.replaceState(null,'',url);notify()}};
export const useRouter=()=>router;
export const usePathname=()=>React.useSyncExternalStore(listen,()=>location.pathname,()=>'/pl/dashboard');
export const useSearchParams=()=>new URLSearchParams(React.useSyncExternalStore(listen,()=>location.search,()=>''));`

export async function bundleAdp(entry, {browser = false, write = false, outdir, metafile = false} = {}) {
  verifyPublicAdoption()
  const {build} = runtimeRequire('esbuild')
  return build({entryPoints: [path.resolve(appRoot, entry)], absWorkingDir: appRoot, bundle: true, write,
    ...(write ? {outdir} : {}), ...(browser ? {define:{'process.env':'{}'}} : {}), platform: browser ? 'browser' : 'node', format: browser ? 'esm' : 'cjs', metafile, jsx:'automatic',
    loader: {'.css': browser ? 'css' : 'empty', '.woff2':'dataurl'}, alias: {'@': appRoot},
    nodePaths: [path.dirname(runtimeRequire.resolve('react/package.json')), path.join(path.dirname(process.env.APPSHELL_TEST_RUNTIME || path.join(appRoot, 'package.json')), 'node_modules')],
    external: browser ? ['/benchmark-visual/*'] : ['react', 'react-dom', 'react-dom/client', 'react-dom/server', 'react/jsx-runtime'],
    plugins: [{name: 'public-acceptance-boundaries', setup(b) {
      b.onResolve({filter: /\.css\?inline$/}, args => ({path:path.resolve(args.resolveDir,args.path.replace(/\?inline$/, '')),namespace:'acceptance-inline-css'}))
      b.onLoad({filter:/.*/,namespace:'acceptance-inline-css'},args=>({contents:fs.readFileSync(args.path,'utf8'),loader:'text'}))
      // Test bundling resolves the declared public business entry from this candidate.
      // Production uses the independently installed normal file dependency.
      b.onResolve({filter:/^@profitia\/sg2-price-change-index-ui\/business$/},()=>{
        const consumer=JSON.parse(fs.readFileSync(path.join(appRoot,'package.json'),'utf8'))
        if(consumer.dependencies['@profitia/sg2-price-change-index-ui']!=='file:../../packages/sg2-price-change-index-ui')throw Error('Unaccepted PCI package binding')
        return{path:path.resolve(appRoot,'../../packages/sg2-price-change-index-ui/src/business.ts')}
      })
      b.onResolve({filter: /^@profitia\/srm-adp-ui(?:\/styles\.css)?$/}, args => ({path: path.join(publicRoot, args.path.endsWith('/styles.css') ? 'src/styles.css' : 'src/index.ts')}))
      b.onResolve({filter: /^(?:next\/(?:navigation|image|link)|@clerk\/react|@\/components\/auth\/clerk-sign-up)$/}, args => ({path: args.path, namespace: 'acceptance-only'}))
      b.onLoad({filter: /.*/, namespace: 'acceptance-only'}, args => ({loader: 'js', resolveDir: appRoot, contents: args.path === 'next/navigation' ? (browser ? previewNavigation : testNavigation)
        : args.path === '@clerk/react' ? 'import React from \'react\';export const useAuth=()=>globalThis.__adpTestAuth||{isLoaded:false};export const useClerk=()=>globalThis.__adpTestClerk;export const ClerkProvider=({children})=>children;export const ClerkFailed=()=>null;export const SignOutButton=({children})=>children;'
        : args.path.endsWith('clerk-sign-up') ? `import React from 'react';export const SelfServiceAuthentication=()=>React.createElement('div',{'data-existing-auth-flow':true});`
        : `import React from 'react';export default function Element(props){return React.createElement('${args.path === 'next/image' ? 'img' : 'a'}',props);}`}))
    }}]})
}

export async function loadAdpModule(entry) {
  const result = await bundleAdp(entry), module = {exports: {}}
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(runtimeRequire, module, module.exports)
  return module.exports
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outdir = process.env.ADP_PREVIEW_OUTPUT
  if (!outdir || !path.isAbsolute(outdir)) throw Error('Explicit absolute acceptance output directory required')
  fs.mkdirSync(outdir, {recursive: true})
  await bundleAdp('tests/adp-appshell-preview.tsx', {browser: true, write: true, outdir})
  const html = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/preview.css"><style>body{margin:0}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="/preview.js"></script></body></html>'
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1'), route = url.pathname
    if (/^\/(?:pl|en)\/dashboard(?:\/adp)?\/?$/.test(route)) {res.setHeader('Content-Type', 'text/html');res.end(html);return}
    const output = route === '/preview.js' || route === '/preview.css' ? path.join(outdir, `adp-appshell-${route.slice(1)}`) : null
    const asset = /^\/(?:appshell\/[\w.-]+|benchmark-visual\/inter-latin(?:-ext)?\.woff2)$/.test(route) ? path.join(appRoot, 'public', route) : null
    const file = output || asset
    if (!file || !fs.existsSync(file)) {res.statusCode = 404;res.end();return}
    const ext = path.extname(file);res.setHeader('Content-Type', ({'.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2'})[ext] || 'application/octet-stream')
    res.end(fs.readFileSync(file))
  })
  server.listen(Number(process.env.ADP_PREVIEW_PORT || 33566), '127.0.0.1', () => console.log('Public-only AppShell acceptance preview ready'))
}

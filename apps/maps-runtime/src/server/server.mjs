import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {readConfig, publicConfig} from './config.mjs'

const appRoot = fileURLToPath(new URL('../../', import.meta.url))
const types = {'.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json'}

export function createMapsServer(config, {root = path.join(appRoot, 'dist')} = {}) {
  const ancestors = ["'self'", ...config.allowedHostOrigins].join(' ')
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()')
    res.setHeader('Content-Security-Policy', `default-src 'self'; script-src 'self' https://maps.googleapis.com https://maps.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.googleusercontent.com; connect-src 'self' https://*.googleapis.com https://*.google.com https://*.gstatic.com; worker-src blob:; frame-src 'self' https://*.google.com; frame-ancestors ${ancestors}; object-src 'none'; base-uri 'none'`)
    const json = (status, value) => {res.writeHead(status, {'Content-Type': 'application/json'}); res.end(JSON.stringify(value))}
    if (!['GET', 'HEAD'].includes(req.method)) return json(405, {error: 'Method not allowed'})
    const url = new URL(req.url, 'http://localhost')
    if (url.pathname === '/api/health') return json(200, {service: 'maps-runtime', environment: config.environment, configured: config.configured, revision: config.revision, mode: 'read-only', persistence: false})
    if (url.pathname === '/api/config') return json(200, publicConfig(config))
    let pathname
    try {pathname = decodeURIComponent(url.pathname)} catch {return json(400, {error: 'Invalid path'})}
    if (!/^\/[a-zA-Z0-9_./-]*$/.test(pathname) || pathname.split('/').includes('..') || pathname.includes('//')) return json(404, {error: 'Not found'})
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1)
    const file = path.resolve(root, relative)
    if (!file.startsWith(path.resolve(root) + path.sep)) return json(404, {error: 'Not found'})
    try {
      const content = await fs.readFile(file)
      res.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream'})
      res.end(req.method === 'HEAD' ? undefined : content)
    } catch {json(404, {error: 'Not found'})}
  })
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = readConfig()
  const server = createMapsServer(config)
  const port = Number(process.env.PORT || 3410)
  server.listen(port, '0.0.0.0', () => console.log(`Maps Runtime ${config.environment} listening on ${port}; configured=${config.configured}`))
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {server.close(() => process.exit(0)); setTimeout(() => process.exit(1), 10000).unref()})
}

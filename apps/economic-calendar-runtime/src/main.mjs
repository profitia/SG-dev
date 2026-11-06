import {loadConfiguration} from './config.mjs'
import {createDatabase} from './database.mjs'
import {createAuthorizer} from './authorization.mjs'
import {createRepository} from './repository.mjs'
import {createServer} from './server.mjs'
async function main() {
  const configuration = loadConfiguration(), binding = {databaseName: configuration.databaseName, role: configuration.runtimeRole}
  const database = createDatabase({connectionString: configuration.connectionString, binding})
  try {
    const authorizer = await createAuthorizer(configuration, database), repository = createRepository(configuration, database)
    if (!await repository.ready() || !await authorizer.ready()) throw new Error('PREREQUISITES_NOT_READY')
    const server = createServer({configuration, authorizer, repository, report: event => process.stdout.write(JSON.stringify(event) + '\n')})
    server.listen(configuration.port, '0.0.0.0')
    let stopping = false
    const stop = () => {if (stopping) return; stopping = true; server.close(() => {void database.close().finally(() => process.exit(0))}); setTimeout(() => process.exit(1), 15000).unref()}
    process.once('SIGTERM', stop); process.once('SIGINT', stop)
  } catch (error) {await database.close(); throw error}
}
main().catch(() => {process.stderr.write('{"error":"ECR_STARTUP_REFUSED"}\n'); process.exitCode = 1})

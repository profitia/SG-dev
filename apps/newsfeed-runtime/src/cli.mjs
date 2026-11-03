import fs from 'node:fs/promises';
import { createNewsApiProvider, DiscoveryError, prepareSearch } from './newsapi.mjs';
import { getCapabilities } from './capabilities.mjs';

// Query files contain explicit search criteria, never a key or an authenticated host context.
const [command, inputPath] = process.argv.slice(2);
try {
  if (command === 'capabilities' && !inputPath) console.log(JSON.stringify(getCapabilities(),null,2));
  else {
    if (!['search','publishers','plan'].includes(command) || !inputPath || process.argv.length !== 4) throw new DiscoveryError('USAGE_SEARCH_PUBLISHERS_OR_PLAN_JSON_FILE');
    const input = await fs.readFile(inputPath, 'utf8');
    if (Buffer.byteLength(input) > 16384) throw new DiscoveryError('INPUT_TOO_LARGE');
    let query; try { query = JSON.parse(input); } catch { throw new DiscoveryError('INVALID_JSON_INPUT'); }
    if (command === 'plan') {
      const plan = prepareSearch(query);
      console.log(JSON.stringify({endpoint:plan.endpoint,parameters:Object.fromEntries(plan.params),networkRequestPerformed:false},null,2));
    } else {
      const provider = createNewsApiProvider({apiKey:process.env.NEWSAPI_API_KEY ?? '',targetEnvironment:/** @type {'development'} */(process.env.TARGET_ENVIRONMENT)});
      const result = command === 'search' ? await provider.search(query) : await provider.listPublishers(query);
      console.log(JSON.stringify(result,null,2));
    }
  }
} catch (error) {
  console.error(JSON.stringify(error instanceof DiscoveryError ? error.toJSON() : {code:'CLI_INPUT_ERROR'}));
  process.exitCode = 1;
}

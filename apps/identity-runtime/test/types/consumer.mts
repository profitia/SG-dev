import type { SessionBoundary, RuntimeConfiguration, HumanActor } from '../../src/contracts.js'
import { createOfficialClient } from '../../src/official-client.js'
import type { ClerkIdentityClient } from '@profitia/platform-contracts/identity-provider'
declare const boundary: SessionBoundary
declare const configuration: RuntimeConfiguration
const sdk: ClerkIdentityClient = createOfficialClient(configuration, 'sk_test_fixture')
const checked: Promise<boolean> = boundary.ready()
// @ts-expect-error verified actor cannot originate from an HTTP user ID
const actor: HumanActor = { userId: 'caller' }
// @ts-expect-error only registered Development runtime configuration
const environment: RuntimeConfiguration['environment'] = 'production'
void [sdk, checked, actor, environment]

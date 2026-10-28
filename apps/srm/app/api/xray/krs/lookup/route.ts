import {withSrmPeerXRay} from '../../../../../src/server/peer-xray';
import {createKrsNameHttpHandler} from '../../../../../src/server/krs-name-runtime';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const POST=withSrmPeerXRay(createKrsNameHttpHandler('lookup'));

import {createKrsNameHttpHandler} from '../../../../../src/server/krs-name-runtime';
import {withSrmPresentationPeer} from '../../../../../src/server/peer-xray-presentation';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const POST=withSrmPresentationPeer(createKrsNameHttpHandler('selection'));

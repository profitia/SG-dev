import {createCachedSupplierIdentityHttpHandler} from '../../../../../src/server/supplier-cached-identity-runtime';
import {withSrmPresentationPeer} from '../../../../../src/server/peer-xray-presentation';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const POST=withSrmPresentationPeer(createCachedSupplierIdentityHttpHandler());

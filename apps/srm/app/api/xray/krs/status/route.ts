import {createKrsNameHttpHandler} from '../../../../../src/server/krs-name-runtime';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const GET=createKrsNameHttpHandler('status');

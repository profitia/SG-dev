import test from 'node:test';
import assert from 'node:assert/strict';
import {publicationQuery} from '../src/publication-query.mjs';
test('publication filters reject invalid dates, unbounded queries, repeated markets and unsupported sort before SQL',()=>{
 assert.deepEqual(publicationQuery({search:' oil ',markets:['oil-asphalt'],fromDate:'2026-10-25',throughDate:'2026-11-01',order:'oldest',sharedOnly:true}),{search:'oil',markets:['oil-asphalt'],fromDate:'2026-10-25',throughDate:'2026-11-01',order:'oldest',sharedOnly:true});
 for(const options of[{fromDate:'2026-02-30'},{fromDate:'2026-11-10',throughDate:'2026-11-01'},{search:'x'.repeat(201)},{markets:['oil-asphalt','oil-asphalt']},{markets:["x'); DROP TABLE anything;--"]},{order:'arbitrary SQL'},{sharedOnly:'true'}])assert.throws(()=>publicationQuery(options));
});

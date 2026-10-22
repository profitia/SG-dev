import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {SupplierLocations} from './supplier-locations-view'
test('closed MAP-01 entry is an accessible icon and does not eagerly mount a map or modal',()=>{
 const html=renderToStaticMarkup(React.createElement(SupplierLocations,{supplierId:'11111111-1111-4111-8111-111111111111',refreshKey:'accepted-v1'}))
 assert.match(html,/aria-label="Otwórz lokalizację dostawcy w Google Maps"/)
 assert.match(html,/aria-haspopup="dialog"/);assert.match(html,/aria-expanded="false"/)
 assert.match(html,/maps_48dp.png/);assert.match(html,/width="30" height="30" alt=""/)
 assert.doesNotMatch(html,/<dialog|<iframe|maps.googleapis.com|<script|Podmioty powiązane/)
 assert.equal((html.match(/<button/g)??[]).length,1)
})

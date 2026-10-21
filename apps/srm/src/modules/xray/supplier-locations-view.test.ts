import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {SupplierLocations} from './supplier-locations-view'
test('initial supplier view is accessible, keeps the three groups and does not eagerly mount Google',()=>{
 const html=renderToStaticMarkup(React.createElement(SupplierLocations,{supplierId:'11111111-1111-4111-8111-111111111111',refreshKey:'accepted-v1'}))
 for(const label of ['Google Maps','Siedziba i oddziały','Podmioty powiązane','Własne lokalizacje'])assert(html.includes(label))
 assert.match(html,/<dialog[^>]*aria-labelledby=/);assert.doesNotMatch(html,/<iframe|maps.googleapis.com|<script/)
 assert.match(html,/nie została potwierdzona/)
})

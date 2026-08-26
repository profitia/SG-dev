import assert from 'node:assert/strict'
import test from 'node:test'

import {
  formatDisplayMeasurement,
  isSuppressedProviderIdentity,
  isTechnicalIdentifier,
  sanitizeUserFacingPublisher,
  sanitizeUserFacingResolvedLabel,
} from '../lib/benchmark/presentation'

test('suppresses provider identity and raw technical identifiers', () => {
  assert.equal(isSuppressedProviderIdentity('Macrobond'), true)
  assert.equal(isSuppressedProviderIdentity('Macrobond Financial AB'), true)
  assert.equal(isTechnicalIdentifier('src_useia'), true)
  assert.equal(isTechnicalIdentifier('rel_useiaspotpric'), true)
  assert.equal(isTechnicalIdentifier('alt_esg'), true)

  assert.equal(sanitizeUserFacingPublisher('Macrobond'), null)
  assert.equal(sanitizeUserFacingPublisher('src_useia'), null)
  assert.equal(sanitizeUserFacingPublisher('Eurostat'), 'Eurostat')
  assert.equal(sanitizeUserFacingPublisher('Energy Information Administration (EIA)'), 'Energy Information Administration (EIA)')
  assert.equal(sanitizeUserFacingPublisher('Hamburg Institute of International Economics (HWWI)'), 'Hamburg Institute of International Economics (HWWI)')
  assert.equal(sanitizeUserFacingResolvedLabel('rel_useiaspotpric'), null)
})

test('formats display measurements without duplicating currency prefixes', () => {
  assert.equal(formatDisplayMeasurement('USD', 'USD/Barrel'), 'USD/Barrel')
  assert.equal(formatDisplayMeasurement('USD', 'Index'), 'USD Index')
  assert.equal(formatDisplayMeasurement(null, 'Hours'), 'Hours')
  assert.equal(formatDisplayMeasurement('usd', 'usd'), 'USD')
  assert.equal(formatDisplayMeasurement('usd', 'usd/barrel'), 'USD/barrel')
  assert.equal(formatDisplayMeasurement(null, 'usd/barrel'), 'USD/barrel')
})
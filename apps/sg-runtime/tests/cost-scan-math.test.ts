import test from 'node:test'
import assert from 'node:assert/strict'

import {
  calculateBenchmarkChangePercent,
  calculateCategoryMovementPercent,
  calculateContributionPercentagePoints,
  deriveCostPressureDirection,
  findMainDownwardDriver,
  findMainUpwardDriver,
} from '../lib/cost-scan/math'

test('cost scan math preserves the 70/20/5/5 weighted movement model', () => {
  const lldpeChange = calculateBenchmarkChangePercent(100, 110)
  const energyChange = calculateBenchmarkChangePercent(100, 105)
  const labourChange = calculateBenchmarkChangePercent(100, 103)
  const transportChange = calculateBenchmarkChangePercent(100, 98)

  assert.equal(lldpeChange, 10)
  assert.equal(energyChange, 5)
  assert.equal(labourChange, 3)
  assert.equal(transportChange, -2)

  const lldpeContribution = calculateContributionPercentagePoints(70, lldpeChange ?? 0)
  const energyContribution = calculateContributionPercentagePoints(20, energyChange ?? 0)
  const labourContribution = calculateContributionPercentagePoints(5, labourChange ?? 0)
  const transportContribution = calculateContributionPercentagePoints(5, transportChange ?? 0)

  assert.equal(lldpeContribution, 7)
  assert.equal(energyContribution, 1)
  assert.equal(labourContribution, 0.15)
  assert.equal(transportContribution, -0.1)

  const categoryMovement = calculateCategoryMovementPercent([
    lldpeContribution,
    energyContribution,
    labourContribution,
    transportContribution,
  ])

  assert.equal(categoryMovement, 8.05)
  assert.equal(deriveCostPressureDirection(categoryMovement), 'UPWARD')

  const upward = findMainUpwardDriver([
    { name: 'LLDPE', contributionPercentagePoints: lldpeContribution },
    { name: 'Energy', contributionPercentagePoints: energyContribution },
    { name: 'Labour', contributionPercentagePoints: labourContribution },
    { name: 'Transport', contributionPercentagePoints: transportContribution },
  ])

  const downward = findMainDownwardDriver([
    { name: 'LLDPE', contributionPercentagePoints: lldpeContribution },
    { name: 'Energy', contributionPercentagePoints: energyContribution },
    { name: 'Labour', contributionPercentagePoints: labourContribution },
    { name: 'Transport', contributionPercentagePoints: transportContribution },
  ])

  assert.deepEqual(upward, { name: 'LLDPE', contributionPercentagePoints: 7 })
  assert.deepEqual(downward, { name: 'Transport', contributionPercentagePoints: -0.1 })
})
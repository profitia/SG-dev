export function resolveDatePlotOffset(allDates: string[], date: string) {
  const directIndex = allDates.indexOf(date)

  if (directIndex >= 0) {
    return directIndex
  }

  const targetTime = new Date(date).getTime()

  if (!Number.isFinite(targetTime) || allDates.length === 0) {
    return 0
  }

  const allDateTimes = allDates.map((entry) => new Date(entry).getTime())
  const firstTime = allDateTimes[0]
  const lastTime = allDateTimes[allDateTimes.length - 1]

  if (targetTime <= firstTime) {
    return 0
  }

  if (targetTime >= lastTime) {
    return allDateTimes.length - 1
  }

  for (let index = 1; index < allDateTimes.length; index += 1) {
    const leftTime = allDateTimes[index - 1]
    const rightTime = allDateTimes[index]

    if (targetTime > rightTime) {
      continue
    }

    const range = rightTime - leftTime || 1
    return (index - 1) + ((targetTime - leftTime) / range)
  }

  return allDateTimes.length - 1
}
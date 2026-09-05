export function isKnownWordsMilestone(count: number) {
  return [10, 25, 50, 100, 250, 500, 1000].includes(count)
    || (count > 1000 && count % 500 === 0);
}

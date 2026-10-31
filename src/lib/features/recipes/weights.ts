export function mgToG(mg: number): number {
  return mg / 1000
}

export function gToMg(g: number): number {
  return g * 1000
}

export function totalMass(massesMg: number[]): number {
  return massesMg.reduce((sum, mass) => sum + mass, 0)
}

/** Convert ingredient masses to percentages that sum to 100 (or 0 if empty). */
export function percentsFromMasses(massesMg: number[]): number[] {
  const sum = totalMass(massesMg)
  if (sum <= 0) {
    return massesMg.map(() => 0)
  }
  return massesMg.map((mass) => (mass / sum) * 100)
}

export function formatMg(mg: number): string {
  if (Number.isInteger(mg)) return `${mg} mg`
  return `${mg.toFixed(1)} mg`
}

export function formatGrams(mg: number): string {
  return `${mgToG(mg).toFixed(3)} g`
}

export function scaleIngredients(
  ingredients: { paintId: string; percent: number }[],
  totalMassMg: number,
  minMg = 1,
): { paintId: string; weightMg: number; percent: number }[] {
  const raw = ingredients.map((item) => (item.percent / 100) * totalMassMg)
  const rounded: number[] = raw.map((mass) => (mass < minMg ? 0 : Math.round(mass)))
  if (totalMass(rounded) === 0 && ingredients.length > 0) {
    const index = raw.indexOf(Math.max(...raw))
    rounded[index] = Math.round(totalMassMg)
  }
  const drift = Math.round(totalMassMg) - rounded.reduce((sum, mass) => sum + mass, 0)
  if (drift !== 0) {
    const index = rounded.indexOf(Math.max(...rounded))
    if (index >= 0) rounded[index] = Math.max(0, (rounded[index] ?? 0) + drift)
  }
  const total = rounded.reduce((sum, mass) => sum + mass, 0)
  return ingredients
    .map((item, index) => ({
      paintId: item.paintId,
      weightMg: rounded[index] ?? 0,
      percent: total > 0 ? ((rounded[index] ?? 0) / total) * 100 : 0,
    }))
    .filter((item) => item.weightMg > 0)
}

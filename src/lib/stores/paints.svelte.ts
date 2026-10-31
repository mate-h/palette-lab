import { loadDevelopmentPaints } from '@/lib/data/paints'
import type { UserPaint } from '@/lib/domain'

class PaintLibraryStore {
  paints = $state<UserPaint[]>([])
  selectedId = $state<string | null>(null)

  get available(): UserPaint[] {
    return this.paints.filter((paint) => paint.available)
  }

  byId(id: string): UserPaint | undefined {
    return this.paints.find((paint) => paint.product.id === id)
  }

  select(id: string | null): void {
    this.selectedId = id
  }

  setAvailable(id: string, available: boolean): void {
    this.paints = this.paints.map((paint) =>
      paint.product.id === id ? { ...paint, available } : paint,
    )
  }

  async hydrate(): Promise<void> {
    this.paints = await loadDevelopmentPaints()
  }
}

export const paintLibraryStore = new PaintLibraryStore()

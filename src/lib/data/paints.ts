import { colorFromHex } from '@/lib/color'
import type { OpacityClass, UserPaint } from '@/lib/domain'
import { goldenById } from './golden'

export interface PaintFixture {
  id: string
  name: string
  colourIndex: string
  pigmentName: string
  hex: string
  opacity: OpacityClass
  tintingStrength: number
  densityGPerMl?: number
}

/**
 * Development paint set — Golden Heavy Body Acrylic Essentials-style
 * plus Yellow Ochre. Catalog hex values are approximations, not measurements.
 */
export const developmentPaintFixtures: PaintFixture[] = [
  fixture('tw', 'Titanium White', 'PW6', 'Titanium Dioxide', '#F4F1E8', 'opaque', 0.35, 1.4),
  fixture('cb', 'Carbon Black', 'PBk7', 'Carbon Black', '#1A1A1A', 'opaque', 1.1, 1.3),
  fixture('by', 'Benzimidazolone Yellow Medium', 'PY154', 'Benzimidazolone Yellow', '#E8B400', 'semi-opaque', 1.0),
  fixture('qm', 'Quinacridone Magenta', 'PR122', 'Quinacridone Magenta', '#9B1B4A', 'transparent', 1.2),
  fixture('pb', 'Phthalo Blue (Green Shade)', 'PB15:3', 'Copper Phthalocyanine', '#0A3D7A', 'transparent', 1.4),
  fixture('pg', 'Phthalo Green (Blue Shade)', 'PG7', 'Chlorinated Copper Phthalocyanine', '#0B5C4A', 'transparent', 1.3),
  fixture('yo', 'Yellow Ochre', 'PY43', 'Natural Hydrated Iron Oxide', '#C8A04A', 'semi-opaque', 0.7, 1.5),
]

function fixture(
  id: string,
  name: string,
  colourIndex: string,
  pigmentName: string,
  hex: string,
  opacity: OpacityClass,
  tintingStrength: number,
  densityGPerMl?: number,
): PaintFixture {
  return { id, name, colourIndex, pigmentName, hex, opacity, tintingStrength, densityGPerMl }
}

export async function loadDevelopmentPaints(): Promise<UserPaint[]> {
  return Promise.all(developmentPaintFixtures.map(paintFromFixture))
}

export async function paintFromFixture(entry: PaintFixture): Promise<UserPaint> {
  const golden = goldenById(entry.id)
  return {
    available: true,
    appearance: {
      color: await colorFromHex(golden?.swatchHex ?? entry.hex),
      source: 'catalog-approx',
    },
    product: {
      id: entry.id,
      name: golden?.name ?? entry.name,
      manufacturer: 'Golden',
      sku: golden?.item,
      line: 'Heavy Body Acrylic',
      opacity: golden?.opacity ?? entry.opacity,
      tintingStrength: entry.tintingStrength,
      densityGPerMl: entry.densityGPerMl,
      pigments: [
        {
          colourIndex: golden?.pigment.colourIndex ?? entry.colourIndex,
          commonName: golden?.pigment.commonName ?? entry.pigmentName,
          notes: golden
            ? `${golden.pigment.chemicalDescription} · ${golden.pigment.classification}`
            : undefined,
        },
      ],
    },
  }
}

export function paintById(id: string): PaintFixture | undefined {
  return developmentPaintFixtures.find((entry) => entry.id === id)
}

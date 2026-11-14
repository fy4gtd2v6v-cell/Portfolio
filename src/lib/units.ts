export const GRAMS_PER_TROY_OUNCE = 31.1034768;

export type WeightUnit = 'g' | 'kg' | 'oz';
export const WEIGHT_UNITS: WeightUnit[] = ['g', 'kg', 'oz'];
export const WEIGHT_UNIT_LABEL: Record<WeightUnit, string> = {
  g: 'Gramm',
  kg: 'Kilogramm',
  oz: 'Feinunze (oz t)',
};

const GRAMS_PER: Record<WeightUnit, number> = {
  g: 1,
  kg: 1000,
  oz: GRAMS_PER_TROY_OUNCE,
};

export function toGrams(value: number, unit: WeightUnit): number {
  return value * GRAMS_PER[unit];
}

export function fromGrams(grams: number, unit: WeightUnit): number {
  return grams / GRAMS_PER[unit];
}

/** Converts a price per `unit` into a price per gram. */
export function pricePerGram(price: number, unit: WeightUnit): number {
  return price / GRAMS_PER[unit];
}

/** Converts a price per gram into a price per `unit`. */
export function pricePerUnit(eurPerGram: number, unit: WeightUnit): number {
  return eurPerGram * GRAMS_PER[unit];
}

/** Fine (pure) metal content in grams, from gross weight and fineness in per mille. */
export function fineGrams(grossGrams: number, finenessPerMille: number): number {
  return (grossGrams * finenessPerMille) / 1000;
}

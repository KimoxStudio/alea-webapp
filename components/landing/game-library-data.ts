export interface GameLibraryEntry {
  title: string
  categoryEs: string
  categoryEn: string
  players: string
  time: string
  weight: number
}

/**
 * Highlights from the club's physical game library (350+ titles).
 * Source: real content provided by the Alea Las Palmas public site.
 */
export const GAME_LIBRARY_HIGHLIGHTS: GameLibraryEntry[] = [
  { title: 'Bolt Action', categoryEs: 'Wargame', categoryEn: 'Wargame', players: '2', time: '120m', weight: 3.2 },
  { title: 'Pathfinder 2e', categoryEs: 'Rol', categoryEn: 'RPG', players: '3–6', time: '∞', weight: 4.1 },
  { title: 'Warhammer 40K', categoryEs: 'Wargame', categoryEn: 'Wargame', players: '2', time: '150m', weight: 4.4 },
  { title: 'Blood on the Clocktower', categoryEs: 'Deducción', categoryEn: 'Deduction', players: '5–20', time: '180m', weight: 2.7 },
  { title: 'Cascadia', categoryEs: 'Familiar', categoryEn: 'Family', players: '1–4', time: '45m', weight: 1.9 },
  { title: 'Heat: Pedal to the Metal', categoryEs: 'Carreras', categoryEn: 'Racing', players: '2–6', time: '60m', weight: 2.4 },
  { title: 'Dune: Imperium', categoryEs: 'Estrategia', categoryEn: 'Strategy', players: '1–4', time: '90m', weight: 3.0 },
  { title: 'Blood Bowl', categoryEs: 'Deportes', categoryEn: 'Sports', players: '2', time: '90m', weight: 3.0 },
]

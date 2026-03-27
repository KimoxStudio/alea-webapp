import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { MyReservationsView } from '@/components/reservations/my-reservations-view'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('reservations')
  return { title: `${t('title')} — Alea` }
}

export default async function ReservationsPage() {
  return <MyReservationsView />
}

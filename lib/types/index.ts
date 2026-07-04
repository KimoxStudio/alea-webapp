export type Role = 'member' | 'admin';

export interface User {
  id: string;
  memberNumber: string;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  role: Role;
  isActive: boolean;
  noShowCount: number;
  blockedUntil: string | null;
  activeFrom?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemberImportRow {
  rowNumber: number;
  memberNumber: string;
  fullName: string;
  email: string | null;
  phone: string | null;
}

export type MemberImportIssueCode =
  | 'invalid_member_number'
  | 'missing_full_name'
  | 'duplicate_member_number'
  | 'read_existing_failed'
  | 'update_existing_failed'
  | 'create_auth_failed'
  | 'persist_import_failed';

export interface MemberImportIssue {
  rowNumber: number;
  memberNumber?: string | null;
  code: MemberImportIssueCode;
}

export interface MemberImportResult {
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  normalizedRows: MemberImportRow[];
  issues: MemberImportIssue[];
}

export interface Room {
  id: string;
  name: string;
  tableCount: number;
  description?: string;
}

export type TableType = 'small' | 'large' | 'removable_top';
export type TableSurface = 'top' | 'bottom';

export interface GameTable {
  id: string;
  roomId: string;
  name: string;
  type: TableType;
  qrCode: string;
  qrCodeInf?: string | null;
  position?: { x: number; y: number };
}

export interface Reservation {
  id: string;
  tableId: string;
  userId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'active' | 'cancelled' | 'completed' | 'pending' | 'no_show';
  surface?: TableSurface | null;
  activatedAt?: string | null;
  createdAt: string;
  memberNumber?: string | null;
  roomName?: string | null;
  tableName?: string | null;
  equipment?: Equipment[];
}

export type SavedGameStatus = 'active' | 'cancelled' | 'completed';

export interface SavedGame {
  id: string;
  tableId: string;
  userId: string;
  startDate: string;
  endDate: string;
  status: SavedGameStatus;
  attendanceCount: number;
  renewedFromId?: string | null;
  createdAt: string;
  updatedAt: string;
  roomName?: string | null;
  tableName?: string | null;
  canRenew: boolean;
  renewalOpensOn: string;
}

export interface RemovableTopTableStatus {
  topAvailable: boolean;
  bottomAvailable: boolean;
}

export interface TimeSlot {
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  available: boolean;
  source?: 'reservation' | 'event';
  label?: string | null;
}

export interface TableAvailability {
  tableId: string;
  date: string;
  slots: TimeSlot[];
  top?: TimeSlot[];
  bottom?: TimeSlot[];
  conflicts?: TimeSlot[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminEventRoomBlock {
  id: string
  roomId: string
  date: string
  startTime: string
  endTime: string
  allDay: boolean
}

/**
 * A single schedule entry for a multi-day event.
 * Mirrors AdminEventRoomBlock but is the canonical shape used in create/update
 * payloads and UI state — roomId may be null when no room is blocked.
 */
export interface AdminEventSchedule {
  /** Present only on persisted blocks, absent in create payloads */
  id?: string
  roomId: string | null
  date: string
  startTime: string
  endTime: string
  allDay: boolean
}

export interface AdminEvent {
  id: string
  title: string
  description: string | null
  /**
   * Anchor date derived from the earliest schedule block.
   * Used for display / sorting only — do not use for availability checks.
   */
  date: string
  startTime: string
  endTime: string
  createdBy: string | null
  createdAt: string
  allDay: boolean
  /** Raw room-block rows from the DB (legacy field, kept for compat) */
  roomBlocks: AdminEventRoomBlock[]
  /**
   * Canonical multi-day schedule list.  Each entry represents one
   * (room × date × time-range) block.  For single-day events this has
   * exactly one element.
   */
  schedules: AdminEventSchedule[]
}

export type ClubEventDateKind = 'single' | 'range' | 'recurring'
export type ClubEventStatus = 'upcoming' | 'past'

/**
 * Public marketing "club event" (tournaments, game nights, club history) shown
 * on the public landing page. Distinct from AdminEvent, which models
 * room-reservation blocking for the booking platform.
 */
export interface ClubEvent {
  id: string
  titleEs: string
  titleEn: string
  blurbEs: string
  blurbEn: string
  descriptionEs: string | null
  descriptionEn: string | null
  dateKind: ClubEventDateKind
  startDate: string
  endDate: string | null
  recurrenceLabelEs: string | null
  recurrenceLabelEn: string | null
  imageUrl: string | null
  linkUrl: string | null
  status: ClubEventStatus
}

/**
 * Admin (dashboard) view of a public club event (OIR-203) — same underlying
 * "events" row as ClubEvent, with the extra fields the board needs to
 * manage it: category, room-block status, and the raw room blocks for the
 * edit form's "blocks rooms" sub-flow pre-fill.
 */
export interface AdminClubEvent {
  id: string
  titleEs: string
  titleEn: string
  blurbEs: string
  blurbEn: string
  descriptionEs: string | null
  descriptionEn: string | null
  dateKind: ClubEventDateKind
  startDate: string
  endDate: string | null
  recurrenceLabelEs: string | null
  recurrenceLabelEn: string | null
  imageUrl: string | null
  linkUrl: string | null
  categoryEs: string | null
  categoryEn: string | null
  status: ClubEventStatus
  /** True when this event currently has at least one room block attached. */
  blocksRooms: boolean
  roomBlocks: AdminEventRoomBlock[]
}

export interface AdminListClubEventsResult {
  upcoming: AdminClubEvent[]
  past: AdminClubEvent[]
}

/**
 * Public "partner" (colaborador) shown on the landing page — a shop or ally
 * that supports the club. Admin-managed (OIR-204); anon/authenticated
 * visitors only ever see active partners via RLS.
 */
export interface Partner {
  id: string
  name: string
  imageUrl: string
  linkUrl: string | null
  descriptionEs: string | null
  descriptionEn: string | null
  sortOrder: number
}

/**
 * Admin (dashboard) view of a partner — same underlying row as `Partner`,
 * plus the `active` flag the board toggles to show/hide it from the
 * landing without deleting it.
 */
export interface AdminPartner extends Partner {
  active: boolean
}

export interface Equipment {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface AvailableEquipment extends Equipment {
  available: boolean;
  conflictReason?: string | null;
}

export interface ApiError {
  message: string;
  statusCode: number;
  error?: string;
}

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface RegisterRequest {
  memberNumber: string;
  email: string;
  password: string;
}

export interface CreateReservationRequest {
  tableId: string;
  date: string;
  startTime: string;
  endTime: string;
  surface?: TableSurface;
  equipmentIds?: string[];
}

export interface CreateSavedGameRequest {
  tableId: string;
  startDate: string;
  endDate: string;
}

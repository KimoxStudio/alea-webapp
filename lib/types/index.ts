export type Role = 'member' | 'admin';

export interface User {
  id: string;
  memberNumber: string;
  email?: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
  position?: { x: number; y: number };
}

export interface Reservation {
  id: string;
  tableId: string;
  userId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'active' | 'cancelled' | 'completed';
  surface?: TableSurface | null;
  createdAt: string;
  memberNumber?: string | null;
  roomName?: string | null;
  tableName?: string | null;
}

export interface RemovableTopTableStatus {
  topAvailable: boolean;
  bottomAvailable: boolean;
}

export interface TimeSlot {
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  available: boolean;
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
}

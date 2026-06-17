import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock server-only module to allow tests to import server modules
vi.mock('server-only', () => ({}))

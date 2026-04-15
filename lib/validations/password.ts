export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (password.length < 8) errors.push('Minimum 8 characters required')
  if (!/[a-z]/.test(password)) errors.push('Must contain at least one lowercase letter')
  if (!/[A-Z]/.test(password)) errors.push('Must contain at least one uppercase letter')
  if (!/[0-9]/.test(password)) errors.push('Must contain at least one number')
  if (!/^[A-Za-z0-9]+$/.test(password)) errors.push('Must contain only letters and numbers')
  return { valid: errors.length === 0, errors }
}

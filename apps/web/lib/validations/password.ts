export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (password.length < 12) errors.push('Minimum 12 characters required')
  if (!/[a-zA-Z]/.test(password)) errors.push('Must contain at least one letter')
  if (!/[0-9]/.test(password)) errors.push('Must contain at least one number')
  if (!/[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push('Must contain at least one special character')
  return { valid: errors.length === 0, errors }
}

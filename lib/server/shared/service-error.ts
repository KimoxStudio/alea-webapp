export class ServiceError extends Error {
  readonly statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.name = 'ServiceError'
    this.statusCode = statusCode
  }
}

export function serviceError(message: string, statusCode: number): never {
  throw new ServiceError(message, statusCode)
}

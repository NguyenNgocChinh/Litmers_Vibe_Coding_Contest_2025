export interface DomainErrorShape {
  code: string;
  message: string;
  status?: number;
  details?: unknown;
}

export class DomainError extends Error implements DomainErrorShape {
  code: string;
  status: number;
  details?: unknown;

  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
    this.name = 'DomainError';
  }
}

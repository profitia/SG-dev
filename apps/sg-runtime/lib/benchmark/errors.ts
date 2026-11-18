export class BenchmarkAppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly retryAfter?: string,
  ) {
    super(message)
  }
}
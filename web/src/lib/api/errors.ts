export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export function userFacingApiMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 401:
        return "Unauthorized — check your API key.";
      case 403:
        return "Forbidden — missing or invalid admin token for this action.";
      case 404:
        return "Resource not found.";
      case 409:
        return "Conflict — the resource is in an incompatible state.";
      default:
        if (error.status >= 500) {
          return "Upstream server error. Retry in a moment.";
        }
        return error.message || `Request failed (${error.status}).`;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unexpected error.";
}

/** An error a route handler turns into a plain-language failure with an HTTP status. */
export class PackError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "PackError";
    this.status = status;
  }
}

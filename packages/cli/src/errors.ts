export class StartupError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "StartupError";
    this.code = code;
  }
}

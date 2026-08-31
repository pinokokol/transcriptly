export type TranscriptlyErrorCode =
  | "MISSING_BINARY"
  | "MISSING_MODEL"
  | "INVALID_SOURCE"
  | "INVALID_OPTION"
  | "SOURCE_NOT_FOUND"
  | "UNSUPPORTED_URL"
  | "COMMAND_FAILED"
  | "CAPTIONS_UNAVAILABLE"
  | "CONFIGURATION_ERROR"
  | "TRANSCRIPTION_FAILED";

export class TranscriptlyError extends Error {
  readonly code: TranscriptlyErrorCode;

  constructor(code: TranscriptlyErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
  }
}

export class MissingBinaryError extends TranscriptlyError {
  readonly binary: string;

  constructor(binary: string) {
    super(
      "MISSING_BINARY",
      `Required binary "${binary}" was not found. Install it and make sure it is on PATH.`,
    );
    this.binary = binary;
  }
}

export class MissingModelError extends TranscriptlyError {
  readonly model: string;
  readonly path: string;

  constructor(model: string, path: string) {
    super(
      "MISSING_MODEL",
      `Whisper model "${model}" was not found at "${path}". Add the model file there or pass an existing model path.`,
    );
    this.model = model;
    this.path = path;
  }
}

export class InvalidSourceError extends TranscriptlyError {
  readonly source: string;

  constructor(source: string, reason: string) {
    super("INVALID_SOURCE", `Invalid source "${source}": ${reason}`);
    this.source = source;
  }
}

export class InvalidOptionError extends TranscriptlyError {
  readonly option: string;
  readonly value: unknown;

  constructor(option: string, value: unknown, expected: string) {
    super(
      "INVALID_OPTION",
      `Invalid ${option} option "${String(value)}". Expected ${expected}.`,
    );
    this.option = option;
    this.value = value;
  }
}

export class SourceNotFoundError extends TranscriptlyError {
  readonly path: string;

  constructor(path: string) {
    super("SOURCE_NOT_FOUND", `Local media file was not found at "${path}".`);
    this.path = path;
  }
}

export class UnsupportedUrlError extends TranscriptlyError {
  readonly url: string;

  constructor(url: string, detail?: string, options?: ErrorOptions) {
    const suffix = detail ? ` ${detail}` : "";
    super(
      "UNSUPPORTED_URL",
      `Unsupported URL "${url}". Provide a URL supported by yt-dlp or a direct media URL.${suffix}`,
      options,
    );
    this.url = url;
  }
}

export class CommandExecutionError extends TranscriptlyError {
  readonly binary: string;
  readonly exitCode: number;
  readonly stderr: string;

  constructor(binary: string, exitCode: number, stderr: string) {
    const excerpt = stderr.trim() || "No error output was produced.";
    super("COMMAND_FAILED", `${binary} failed with exit code ${exitCode}: ${excerpt}`);
    this.binary = binary;
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}

export class CaptionsUnavailableError extends TranscriptlyError {
  readonly source: string;
  readonly language?: string;

  constructor(source: string, language?: string, options?: ErrorOptions) {
    const qualifier = language ? ` for language "${language}"` : "";
    super(
      "CAPTIONS_UNAVAILABLE",
      `No captions are available${qualifier} for "${source}". Captions mode does not fall back to ASR.`,
      options,
    );
    this.source = source;
    this.language = language;
  }
}

export class ConfigurationError extends TranscriptlyError {
  constructor(message: string) {
    super("CONFIGURATION_ERROR", message);
  }
}

export class TranscriptionError extends TranscriptlyError {
  constructor(message: string, options?: ErrorOptions) {
    super("TRANSCRIPTION_FAILED", message, options);
  }
}

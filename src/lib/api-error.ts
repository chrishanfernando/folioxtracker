import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { trackAsync, EVENTS } from '@/lib/analytics';

export class AppError extends Error {
  readonly status: number;
  readonly clientMessage: string;
  constructor(status: number, clientMessage: string, internalMessage?: string) {
    super(internalMessage ?? clientMessage);
    this.name = this.constructor.name;
    this.status = status;
    this.clientMessage = clientMessage;
  }
}

export class ValidationError extends AppError {
  readonly issues: { path: string; message: string }[];
  constructor(issues: { path: string; message: string }[], internalMessage?: string) {
    super(400, 'Invalid request', internalMessage);
    this.issues = issues;
  }
}

export class ForbiddenError extends AppError {
  constructor(internalMessage?: string) {
    super(403, 'Forbidden', internalMessage);
  }
}

export class NotFoundError extends AppError {
  constructor(internalMessage?: string) {
    super(404, 'Not found', internalMessage);
  }
}

export class UnauthorizedError extends AppError {
  constructor(internalMessage?: string) {
    super(401, 'Unauthorized', internalMessage);
  }
}

interface ApiErrorOptions {
  route?: string;
  method?: string;
}

export function apiError(error: unknown, options: ApiErrorOptions = {}): NextResponse {
  const requestId = randomUUID();

  if (error instanceof ZodError) {
    const issues = error.issues.map(i => ({ path: i.path.join('.'), message: i.message }));
    console.warn(`[api ${requestId}] validation failed`, { ...options, issues });
    const res = NextResponse.json({ error: 'Invalid request', requestId }, { status: 400 });
    res.headers.set('x-request-id', requestId);
    return res;
  }

  if (error instanceof AppError) {
    if (error instanceof ValidationError) {
      console.warn(`[api ${requestId}] ${error.name}`, { ...options, issues: error.issues, internal: error.message });
    } else {
      console.warn(`[api ${requestId}] ${error.name}`, { ...options, internal: error.message });
    }
    const res = NextResponse.json({ error: error.clientMessage, requestId }, { status: error.status });
    res.headers.set('x-request-id', requestId);
    return res;
  }

  console.error(`[api ${requestId}] unhandled error`, { ...options, error });
  trackAsync(EVENTS.ERROR_OCCURRED, {
    props: {
      route: options.route ?? 'unknown',
      method: options.method ?? null,
      errorClass: error instanceof Error ? error.constructor.name : 'unknown',
    },
  });
  // TODO: Sentry capture wired in Group 11
  const res = NextResponse.json({ error: 'Internal error', requestId }, { status: 500 });
  res.headers.set('x-request-id', requestId);
  return res;
}

export async function parseJsonBody<T>(request: Request, schema: { parseAsync: (v: unknown) => Promise<T> }): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ValidationError([{ path: '(root)', message: 'Body must be valid JSON' }], 'JSON parse failure');
  }
  return schema.parseAsync(raw);
}

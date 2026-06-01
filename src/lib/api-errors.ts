import type { ValidationProblem } from "@/lib/types";

export class ValidationError extends Error {
  status: number;
  fieldErrors: ValidationProblem[];

  constructor(message: string, fieldErrors: ValidationProblem[] = [], status = 400) {
    super(message);
    this.name = "ValidationError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export function toErrorResponse(error: unknown) {
  if (error instanceof ValidationError) {
    return Response.json(
      {
        message: error.message,
        fieldErrors: error.fieldErrors,
      },
      { status: error.status },
    );
  }

  if (error instanceof Error) {
    return Response.json({ message: error.message }, { status: 500 });
  }

  return Response.json({ message: "Unknown error" }, { status: 500 });
}

import { Request, Response, NextFunction } from 'express'
import { ApiError } from '../types'

/**
 * Global error handler middleware
 */
export function errorHandler(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  })

  // Default error response
  let statusCode = 500
  let message = 'Internal server error'
  let details: any = undefined

  // Handle different error types
  if (error.statusCode) {
    statusCode = error.statusCode
    message = error.message
    details = error.details
  } else if (error.name === 'ValidationError') {
    statusCode = 400
    message = 'Validation error'
    details = error.details
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401
    message = 'Unauthorized'
  } else if (error.name === 'ForbiddenError') {
    statusCode = 403
    message = 'Forbidden'
  } else if (error.name === 'NotFoundError') {
    statusCode = 404
    message = 'Not found'
  }

  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Internal server error'
    details = undefined
  }

  const errorResponse: ApiError = {
    error: getErrorName(statusCode),
    message,
    statusCode
  }

  if (details) {
    errorResponse.details = details
  }

  res.status(statusCode).json(errorResponse)
}

/**
 * Get error name based on status code
 */
function getErrorName(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return 'Bad Request'
    case 401:
      return 'Unauthorized'
    case 403:
      return 'Forbidden'
    case 404:
      return 'Not Found'
    case 409:
      return 'Conflict'
    case 422:
      return 'Unprocessable Entity'
    case 429:
      return 'Too Many Requests'
    case 500:
      return 'Internal Server Error'
    case 502:
      return 'Bad Gateway'
    case 503:
      return 'Service Unavailable'
    default:
      return 'Error'
  }
}

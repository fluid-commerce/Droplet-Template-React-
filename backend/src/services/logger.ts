export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  metadata?: Record<string, any>
  error?: Error
}

class Logger {
  private logLevel: LogLevel

  constructor() {
    const level = process.env.LOG_LEVEL?.toLowerCase() as LogLevel
    this.logLevel = level || (process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG)
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR]
    return levels.indexOf(level) >= levels.indexOf(this.logLevel)
  }

  private formatLog(entry: LogEntry): string {
    const { level, message, timestamp, metadata, error } = entry
    
    let logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`
    
    if (metadata && Object.keys(metadata).length > 0) {
      logMessage += ` | ${JSON.stringify(metadata)}`
    }
    
    if (error) {
      logMessage += `\nError: ${error.message}`
      if (error.stack) {
        logMessage += `\nStack: ${error.stack}`
      }
    }
    
    return logMessage
  }

  private log(level: LogLevel, message: string, metadata?: Record<string, any>, error?: Error): void {
    if (!this.shouldLog(level)) {
      return
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      metadata,
      error
    }

    const formattedMessage = this.formatLog(entry)

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage)
        break
      case LogLevel.INFO:
        console.info(formattedMessage)
        break
      case LogLevel.WARN:
        console.warn(formattedMessage)
        break
      case LogLevel.ERROR:
        console.error(formattedMessage)
        break
    }
  }

  debug(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, metadata)
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, metadata)
  }

  warn(message: string, metadata?: Record<string, any>, error?: Error): void {
    this.log(LogLevel.WARN, message, metadata, error)
  }

  error(message: string, metadata?: Record<string, any>, error?: Error): void {
    this.log(LogLevel.ERROR, message, metadata, error)
  }

  // Convenience methods for common logging scenarios
  apiRequest(method: string, url: string, statusCode?: number, duration?: number): void {
    this.info('API Request', {
      method: method.toUpperCase(),
      url,
      statusCode,
      duration: duration ? `${duration}ms` : undefined
    })
  }

  apiError(method: string, url: string, error: Error, statusCode?: number): void {
    this.error('API Request Failed', {
      method: method.toUpperCase(),
      url,
      statusCode
    }, error)
  }

  databaseQuery(query: string, duration?: number, error?: Error): void {
    if (error) {
      this.error('Database Query Failed', { query: query.substring(0, 100) + '...' }, error)
    } else {
      this.debug('Database Query', {
        query: query.substring(0, 100) + '...',
        duration: duration ? `${duration}ms` : undefined
      })
    }
  }

  fluidApiCall(endpoint: string, success: boolean, error?: Error): void {
    if (success) {
      this.info('Fluid API Call Success', { endpoint })
    } else {
      this.warn('Fluid API Call Failed', { endpoint }, error)
    }
  }
}

// Singleton instance
export const logger = new Logger()

// Export the class for testing
export { Logger }
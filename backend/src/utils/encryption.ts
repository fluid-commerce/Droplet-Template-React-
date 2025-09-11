import * as crypto from 'crypto'
import { logger } from '../services/logger'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16 // For GCM, this is always 16
const SALT_LENGTH = 64
const TAG_LENGTH = 16

/**
 * Get encryption key from environment variable
 * If not set, generate a warning but allow operation for development
 */
function getEncryptionKey(): Buffer {
  const encryptionKey = process.env.ENCRYPTION_KEY
  
  if (!encryptionKey) {
    logger.warn('ENCRYPTION_KEY not set - using fallback key for development only')
    // Use a fallback key for development - NOT for production
    return crypto.scryptSync('fallback-key-dev-only', 'salt', 32)
  }

  // Convert hex string to buffer, or derive key from string
  try {
    // Try to parse as hex first
    if (encryptionKey.length === 64) {
      return Buffer.from(encryptionKey, 'hex')
    }
    
    // Otherwise, derive key from the string
    return crypto.scryptSync(encryptionKey, 'static-salt', 32)
  } catch (error) {
    logger.error('Invalid encryption key format, deriving from string', {}, error as Error)
    return crypto.scryptSync(encryptionKey, 'static-salt', 32)
  }
}

/**
 * Encrypt sensitive data (like authentication tokens)
 */
export function encrypt(text: string): string {
  if (!text) {
    return text
  }

  try {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(IV_LENGTH)
    const salt = crypto.randomBytes(SALT_LENGTH)

    const cipher = crypto.createCipher(ALGORITHM, key)
    cipher.setAAD(salt)

    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const authTag = cipher.getAuthTag()

    // Combine iv + salt + authTag + encrypted data
    const result = iv.toString('hex') + 
                  salt.toString('hex') + 
                  authTag.toString('hex') + 
                  encrypted

    return result
  } catch (error) {
    logger.error('Encryption failed', {}, error as Error)
    // Return original text if encryption fails (for development/fallback)
    return text
  }
}

/**
 * Decrypt sensitive data
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) {
    return encryptedText
  }

  // If text doesn't look encrypted (not hex or too short), return as-is
  if (encryptedText.length < (IV_LENGTH + SALT_LENGTH + TAG_LENGTH) * 2) {
    return encryptedText
  }

  try {
    const key = getEncryptionKey()

    // Extract components
    const iv = Buffer.from(encryptedText.slice(0, IV_LENGTH * 2), 'hex')
    const salt = Buffer.from(encryptedText.slice(IV_LENGTH * 2, (IV_LENGTH + SALT_LENGTH) * 2), 'hex')
    const authTag = Buffer.from(encryptedText.slice((IV_LENGTH + SALT_LENGTH) * 2, (IV_LENGTH + SALT_LENGTH + TAG_LENGTH) * 2), 'hex')
    const encrypted = encryptedText.slice((IV_LENGTH + SALT_LENGTH + TAG_LENGTH) * 2)

    const decipher = crypto.createDecipher(ALGORITHM, key)
    decipher.setAAD(salt)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (error) {
    logger.warn('Decryption failed, returning original text', {}, error as Error)
    // Return original text if decryption fails (might be unencrypted legacy data)
    return encryptedText
  }
}

/**
 * Hash data for comparison (like webhook signatures)
 */
export function createHmacSignature(data: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(data)
  return hmac.digest('hex')
}

/**
 * Verify HMAC signature
 */
export function verifyHmacSignature(data: string, signature: string, secret: string): boolean {
  const expectedSignature = createHmacSignature(data, secret)
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  )
}

/**
 * Generate secure random string for secrets
 */
export function generateSecureSecret(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex')
}
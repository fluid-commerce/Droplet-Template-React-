import { Pool, PoolClient } from 'pg'
import { DropletInstallation, DropletConfig } from '../types'
import { logger } from './logger'
import { encrypt, decrypt } from '../utils/encryption'

export interface ActivityLog {
  id: string
  installation_id: string
  activity_type: string
  description: string
  details?: Record<string, any>
  status: 'success' | 'error' | 'warning'
  created_at: string
  metadata?: Record<string, any>
}

export interface WebhookEvent {
  id: string
  installation_id: string
  event_type: string
  payload: Record<string, any>
  processed: boolean
  created_at: string
  processed_at?: string
  error_message?: string
}

export class DatabaseService {
  private pool: Pool

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/fluid_droplet_db',
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })
  }

  async close(): Promise<void> {
    await this.pool.end()
  }

  async query(text: string, params?: any[]): Promise<any> {
    return this.withClient(async (client) => {
      return await client.query(text, params)
    })
  }

  private async withClient<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()
    const startTime = Date.now()
    try {
      const result = await operation(client)
      const duration = Date.now() - startTime
      logger.debug('Database operation completed', { duration: `${duration}ms` })
      return result
    } catch (error: any) {
      const duration = Date.now() - startTime
      logger.error('Database operation failed', { duration: `${duration}ms` }, error)
      throw error
    } finally {
      client.release()
    }
  }

  // Droplet Installation Methods
  async createInstallation(installation: DropletInstallation): Promise<DropletInstallation> {
    return this.withClient(async (client) => {
      const query = `
        INSERT INTO droplet_installations (
          installation_id, droplet_id, company_id, authentication_token, 
          status, configuration, company_name, company_data
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING 
          id, installation_id, droplet_id, company_id, authentication_token, 
          status, configuration, created_at, updated_at, company_name, company_data
      `
      
      // Encrypt the authentication token before storing
      const encryptedToken = encrypt(installation.authenticationToken)
      
      const values = [
        installation.id, // Using the ID as installation_id
        installation.dropletId,
        installation.companyId,
        encryptedToken, // Store encrypted token
        installation.status,
        JSON.stringify(installation.configuration),
        installation.configuration.companyName,
        null // company_data will be updated separately
      ]

      const result = await client.query(query, values)
      const row = result.rows[0]

      // Log installation creation for audit trail
      logger.info('Installation created successfully', {
        installationId: row.installation_id,
        companyId: row.company_id,
        dropletId: row.droplet_id,
        status: row.status,
        hasEncryptedToken: !!encryptedToken
      })

      return {
        id: row.installation_id,
        dropletId: row.droplet_id,
        companyId: row.company_id,
        authenticationToken: decrypt(row.authentication_token), // Decrypt for return
        status: row.status,
        configuration: row.configuration,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString()
      }
    })
  }

  async getInstallation(installationId: string): Promise<DropletInstallation | null> {
    return this.withClient(async (client) => {
      const query = `
        SELECT 
          id, installation_id, droplet_id, company_id, authentication_token, 
          status, configuration, created_at, updated_at
        FROM droplet_installations 
        WHERE installation_id = $1
      `
      
      const result = await client.query(query, [installationId])
      
      if (result.rows.length === 0) {
        logger.debug('Installation not found', { installationId })
        return null
      }

      const row = result.rows[0]
      
      // Log access for audit trail (without sensitive data)
      logger.debug('Installation accessed', {
        installationId: row.installation_id,
        companyId: row.company_id,
        status: row.status
      })

      return {
        id: row.installation_id,
        dropletId: row.droplet_id,
        companyId: row.company_id,
        authenticationToken: decrypt(row.authentication_token), // Decrypt token
        status: row.status,
        configuration: row.configuration,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString()
      }
    })
  }

  async updateInstallation(installationId: string, updates: Partial<DropletInstallation>): Promise<DropletInstallation | null> {
    return this.withClient(async (client) => {
      const setParts: string[] = []
      const values: any[] = []
      let valueIndex = 1

      if (updates.status !== undefined) {
        setParts.push(`status = $${valueIndex++}`)
        values.push(updates.status)
      }

      if (updates.configuration !== undefined) {
        setParts.push(`configuration = $${valueIndex++}`)
        values.push(JSON.stringify(updates.configuration))
        
        setParts.push(`company_name = $${valueIndex++}`)
        values.push(updates.configuration.companyName)
      }

      if (updates.authenticationToken !== undefined) {
        setParts.push(`authentication_token = $${valueIndex++}`)
        values.push(encrypt(updates.authenticationToken)) // Encrypt before storing
      }

      setParts.push(`updated_at = NOW()`)
      values.push(installationId)

      const query = `
        UPDATE droplet_installations 
        SET ${setParts.join(', ')}
        WHERE installation_id = $${valueIndex}
        RETURNING 
          id, installation_id, droplet_id, company_id, authentication_token, 
          status, configuration, created_at, updated_at
      `

      const result = await client.query(query, values)
      
      if (result.rows.length === 0) {
        return null
      }

      const row = result.rows[0]
      
      // Log update for audit trail
      logger.info('Installation updated successfully', {
        installationId: row.installation_id,
        companyId: row.company_id,
        updatedFields: Object.keys(updates),
        status: row.status
      })

      return {
        id: row.installation_id,
        dropletId: row.droplet_id,
        companyId: row.company_id,
        authenticationToken: decrypt(row.authentication_token), // Decrypt for return
        status: row.status,
        configuration: row.configuration,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString()
      }
    })
  }

  async updateCompanyData(installationId: string, companyData: Record<string, any>): Promise<void> {
    return this.withClient(async (client) => {
      const query = `
        UPDATE droplet_installations 
        SET company_data = $1, updated_at = NOW()
        WHERE installation_id = $2
      `
      await client.query(query, [JSON.stringify(companyData), installationId])
    })
  }

  async deleteInstallation(installationId: string): Promise<boolean> {
    return this.withClient(async (client) => {
      const query = `DELETE FROM droplet_installations WHERE installation_id = $1`
      const result = await client.query(query, [installationId])
      return (result.rowCount || 0) > 0
    })
  }

  // Activity Log Methods
  async logActivity(log: Omit<ActivityLog, 'id' | 'created_at'>): Promise<ActivityLog> {
    return this.withClient(async (client) => {
      const query = `
        INSERT INTO activity_logs (installation_id, activity_type, description, details, status, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, installation_id, activity_type, description, details, status, created_at, metadata
      `
      
      const values = [
        log.installation_id,
        log.activity_type,
        log.description,
        log.details ? JSON.stringify(log.details) : null,
        log.status,
        log.metadata ? JSON.stringify(log.metadata) : null
      ]

      const result = await client.query(query, values)
      const row = result.rows[0]

      return {
        id: row.id,
        installation_id: row.installation_id,
        activity_type: row.activity_type,
        description: row.description,
        details: row.details,
        status: row.status,
        created_at: row.created_at.toISOString(),
        metadata: row.metadata
      }
    })
  }

  async getActivityLogs(installationId: string, limit: number = 50): Promise<ActivityLog[]> {
    return this.withClient(async (client) => {
      const query = `
        SELECT id, installation_id, activity_type, description, details, status, created_at, metadata
        FROM activity_logs 
        WHERE installation_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `
      
      const result = await client.query(query, [installationId, limit])
      
      return result.rows.map((row: any) => ({
        id: row.id,
        installation_id: row.installation_id,
        activity_type: row.activity_type,
        description: row.description,
        details: row.details,
        status: row.status,
        created_at: row.created_at.toISOString(),
        metadata: row.metadata
      }))
    })
  }

  // Webhook Event Methods
  async createWebhookEvent(event: Omit<WebhookEvent, 'id' | 'created_at'>): Promise<WebhookEvent> {
    return this.withClient(async (client) => {
      const query = `
        INSERT INTO webhook_events (installation_id, event_type, payload, processed)
        VALUES ($1, $2, $3, $4)
        RETURNING id, installation_id, event_type, payload, processed, created_at, processed_at, error_message
      `
      
      const values = [
        event.installation_id,
        event.event_type,
        JSON.stringify(event.payload),
        event.processed
      ]

      const result = await client.query(query, values)
      const row = result.rows[0]

      return {
        id: row.id,
        installation_id: row.installation_id,
        event_type: row.event_type,
        payload: row.payload,
        processed: row.processed,
        created_at: row.created_at.toISOString(),
        processed_at: row.processed_at?.toISOString(),
        error_message: row.error_message
      }
    })
  }

  async updateWebhookEvent(eventId: string, updates: Partial<Pick<WebhookEvent, 'processed' | 'processed_at' | 'error_message'>>): Promise<void> {
    return this.withClient(async (client) => {
      const setParts: string[] = []
      const values: any[] = []
      let valueIndex = 1

      if (updates.processed !== undefined) {
        setParts.push(`processed = $${valueIndex++}`)
        values.push(updates.processed)
      }

      if (updates.error_message !== undefined) {
        setParts.push(`error_message = $${valueIndex++}`)
        values.push(updates.error_message)
      }

      if (updates.processed === true) {
        setParts.push(`processed_at = NOW()`)
      }

      values.push(eventId)

      const query = `
        UPDATE webhook_events 
        SET ${setParts.join(', ')}
        WHERE id = $${valueIndex}
      `

      await client.query(query, values)
    })
  }

  async getUnprocessedWebhookEvents(limit: number = 100): Promise<WebhookEvent[]> {
    return this.withClient(async (client) => {
      const query = `
        SELECT id, installation_id, event_type, payload, processed, created_at, processed_at, error_message
        FROM webhook_events 
        WHERE processed = false
        ORDER BY created_at ASC
        LIMIT $1
      `
      
      const result = await client.query(query, [limit])
      
      return result.rows.map((row: any) => ({
        id: row.id,
        installation_id: row.installation_id,
        event_type: row.event_type,
        payload: row.payload,
        processed: row.processed,
        created_at: row.created_at.toISOString(),
        processed_at: row.processed_at?.toISOString(),
        error_message: row.error_message
      }))
    })
  }

  // Health check
  async healthCheck(): Promise<{ status: 'ok' | 'error'; message: string }> {
    try {
      await this.withClient(async (client) => {
        await client.query('SELECT 1')
      })
      return { status: 'ok', message: 'Database connection healthy' }
    } catch (error) {
      return { 
        status: 'error', 
        message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }
    }
  }
}

// Singleton instance
let databaseService: DatabaseService | null = null

export function getDatabaseService(): DatabaseService {
  if (!databaseService) {
    databaseService = new DatabaseService()
  }
  return databaseService
}
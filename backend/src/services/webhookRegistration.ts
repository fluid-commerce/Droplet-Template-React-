export type Logger = {
  info: (message: string) => void
  error: (message: string) => void
  warn?: (message: string) => void
}

export interface WebhookConfig {
  resource: string
  event: string
  url: string
  http_method?: string
  auth_token?: string
  synchronous?: boolean
}

export interface WebhookResponse {
  webhook: {
    id: number
    company_id: number
    resource: string
    event: string
    event_identifier: string
    url: string
    http_method: string
    active: boolean
    auth_token?: string
    created_at: string
    updated_at: string
  }
}

export class WebhookRegistrationService {
  private static readonly FLUID_WEBHOOK_API = 'https://api.fluid.app/api/company/webhooks'

  /**
   * Register all webhooks needed for the droplet
   */
  static async registerDropletWebhooks(
    authToken: string,
    webhookEndpointUrl: string,
    logger: Logger
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const webhooksToRegister: Omit<WebhookConfig, 'url'>[] = [
      // Order events
      { resource: 'order', event: 'created' },
      { resource: 'order', event: 'updated' },
      { resource: 'order', event: 'completed' },
      { resource: 'order', event: 'shipped' },
      { resource: 'order', event: 'cancelled' },
      { resource: 'order', event: 'refunded' },

      // Product events
      { resource: 'product', event: 'created' },
      { resource: 'product', event: 'updated' },
      { resource: 'product', event: 'destroyed' },

      // Droplet lifecycle events
      { resource: 'droplet', event: 'installed' },
      { resource: 'droplet', event: 'uninstalled' }
    ]

    let successCount = 0
    let failedCount = 0
    let skippedCount = 0
    const errors: string[] = []

    logger.info(`🔗 Registering ${webhooksToRegister.length} webhooks for droplet`)

    // First, check existing webhooks to avoid duplicates
    let existingWebhooks: WebhookResponse[] = []
    try {
      logger.info(`🔍 Checking for existing webhooks...`)
      existingWebhooks = await this.listWebhooks(authToken, logger)
      logger.info(`📋 Found ${existingWebhooks.length} existing webhooks`)
    } catch (error) {
      logger.warn?.(`⚠️ Could not list existing webhooks, will attempt to register all: ${error}`)
    }

    for (const webhookConfig of webhooksToRegister) {
      try {
        // Check if this webhook already exists with the same URL
        const alreadyExists = existingWebhooks.some(existing => {
          const webhook = existing?.webhook
          if (!webhook) return false

          return webhook.resource === webhookConfig.resource &&
                 webhook.event === webhookConfig.event &&
                 webhook.url === webhookEndpointUrl &&
                 webhook.active
        })

        if (alreadyExists) {
          skippedCount++
          logger.info(`⏭️ Skipping ${webhookConfig.resource}.${webhookConfig.event} - already registered`)
          continue
        }

        await this.registerSingleWebhook(authToken, {
          ...webhookConfig,
          url: webhookEndpointUrl
        }, logger)

        successCount++
        logger.info(`✅ Registered webhook: ${webhookConfig.resource}.${webhookConfig.event}`)
      } catch (error) {
        failedCount++
        const errorMsg = `Failed to register ${webhookConfig.resource}.${webhookConfig.event}: ${error}`
        errors.push(errorMsg)
        logger.error(`❌ ${errorMsg}`)
      }
    }

    logger.info(`🏁 Webhook registration complete: ${successCount} success, ${skippedCount} skipped, ${failedCount} failed`)

    return { success: successCount, failed: failedCount, errors }
  }

  /**
   * Register a single webhook
   */
  static async registerSingleWebhook(
    authToken: string,
    config: WebhookConfig,
    logger?: Logger
  ): Promise<WebhookResponse> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    try {
      const response = await fetch(this.FLUID_WEBHOOK_API, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          resource: config.resource,
          event: config.event,
          url: config.url,
          http_method: config.http_method || 'post',
          auth_token: config.auth_token,
          synchronous: config.synchronous || false
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Fluid API error: ${response.status} - ${errorText}`)
      }

      const result = await response.json() as WebhookResponse

      logger?.info(`✅ Webhook registered: ${config.resource}.${config.event} -> ${config.url}`)
      logger?.info(`🆔 Webhook ID: ${result.webhook.id}, Event identifier: ${result.webhook.event_identifier}`)

      return result
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error) {
        throw new Error(`Failed to register webhook ${config.resource}.${config.event}: ${error.message}`)
      }
      throw new Error(`Failed to register webhook ${config.resource}.${config.event}: Unknown error`)
    }
  }

  /**
   * List all existing webhooks
   */
  static async listWebhooks(
    authToken: string,
    logger?: Logger
  ): Promise<WebhookResponse[]> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    try {
      const response = await fetch(this.FLUID_WEBHOOK_API, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Fluid API error: ${response.status} - ${errorText}`)
      }

      const result = await response.json() as { webhooks?: any[] }
      logger?.info(`📋 Found ${result.webhooks?.length || 0} existing webhooks`)

      // Handle both possible response formats from Fluid API
      const webhooks = result.webhooks || []

      // Normalize the response format - webhooks might come as { webhook: {...} } or just {...}
      const normalized = webhooks.map(w => {
        if (w.webhook) {
          // Already in correct format
          return w as WebhookResponse
        } else {
          // Wrap in webhook property
          return { webhook: w } as WebhookResponse
        }
      })

      return normalized
    } catch (error) {
      clearTimeout(timeoutId)
      logger?.error(`❌ Failed to list webhooks: ${error}`)
      throw error
    }
  }

  /**
   * Delete a webhook by ID
   */
  static async deleteWebhook(
    authToken: string,
    webhookId: number,
    logger?: Logger
  ): Promise<void> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    try {
      const response = await fetch(`${this.FLUID_WEBHOOK_API}/${webhookId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Fluid API error: ${response.status} - ${errorText}`)
      }

      logger?.info(`🗑️ Webhook ${webhookId} deleted successfully`)
    } catch (error) {
      clearTimeout(timeoutId)
      logger?.error(`❌ Failed to delete webhook ${webhookId}: ${error}`)
      throw error
    }
  }

  /**
   * Generate the webhook endpoint URL for this installation
   */
  static generateWebhookUrl(baseUrl: string): string {
    // Remove trailing slash and add webhook path
    const cleanBaseUrl = baseUrl.replace(/\/$/, '')
    return `${cleanBaseUrl}/api/webhook/fluid`
  }

  /**
   * Validate webhook configuration
   */
  static validateWebhookConfig(config: WebhookConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!config.resource) errors.push('Resource is required')
    if (!config.event) errors.push('Event is required')
    if (!config.url) errors.push('URL is required')

    if (config.url && !config.url.startsWith('https://')) {
      errors.push('Webhook URL must use HTTPS')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }
}

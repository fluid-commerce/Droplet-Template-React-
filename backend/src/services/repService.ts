import { prisma } from '../db'

export interface FluidRep {
  id: number
  first_name: string
  last_name: string
  email?: string
  phone?: string
  active?: boolean
  external_id?: string
  username?: string
  share_guid?: string
  image_url?: string
  roles?: string
  country_code?: string
  language_code?: string
  computed_full_name?: string
  computed_email?: string
  customer_id?: number
  [key: string]: any // Allow for additional fields from Fluid API
}

export interface FluidRepsResponse {
  reps: FluidRep[]
  meta: {
    request_id: string
    timestamp: string
    pagination?: {
      page: number
      per_page: number
      total_pages: number
      total_count: number
    }
  }
}

export class RepService {
  /**
   * Fetch reps from Fluid API
   */
  static async fetchRepsFromFluid(
    companyShop: string,
    authToken: string,
    page: number = 1,
    perPage: number = 50
  ): Promise<FluidRepsResponse> {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
      active: 'true' // Only fetch active reps by default
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    try {
      // Try company endpoint first (works with both dit_ and PT tokens)
      const possibleEndpoints = [
        `https://${companyShop}.fluid.app/api/v2/reps?${queryParams}`, // Company endpoint
        `https://api.fluid.app/api/v2/reps?company=${companyShop}&${queryParams}` // Fallback: global API
      ];

      let response = null;

      for (const endpoint of possibleEndpoints) {
        try {
          response = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            },
            signal: controller.signal
          });

          if (response.ok) {
            break;
          }
        } catch (endpointError: any) {
          // Try next endpoint
        }
      }

      if (!response || !response.ok) {
        throw new Error(`All rep API endpoints failed. Last status: ${response?.status || 'No response'}`);
      }

      clearTimeout(timeoutId)

      const raw: any = await response.json()

      // Response format: { reps: [...], meta: { request_id, timestamp, pagination } }
      const reps = raw?.reps || []
      const meta = raw?.meta || {}

      return { reps, meta }
    } catch (error: any) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        throw new Error('Request timeout: Fluid API took too long to respond')
      }
      throw error
    }
  }

  /**
   * Sync reps from Fluid to our database
   */
  static async syncRepsFromFluid(
    installationId: string,
    companyShop: string,
    authToken: string
  ): Promise<{ synced: number; errors: number }> {
    try {
      // Fetch all reps from Fluid (with pagination)
      let page = 1
      let hasMorePages = true
      let syncedCount = 0
      let errorCount = 0

      while (hasMorePages) {
        const fluidResponse = await this.fetchRepsFromFluid(companyShop, authToken, page, 50)

        // Process each rep
        for (const fluidRep of fluidResponse.reps) {
          try {
            await prisma.$executeRaw`
              INSERT INTO reps (
                id, "installationId", "fluidRepId", "firstName", "lastName", email, phone,
                active, "externalId", username, "shareGuid", "imageUrl", roles,
                "countryCode", "languageCode", "computedFullName", "computedEmail",
                "customerId", "createdAt", "updatedAt"
              ) VALUES (
                gen_random_uuid(), ${installationId}, ${fluidRep.id.toString()},
                ${fluidRep.first_name}, ${fluidRep.last_name}, ${fluidRep.email || null},
                ${fluidRep.phone || null}, ${fluidRep.active ?? true},
                ${fluidRep.external_id || null}, ${fluidRep.username || null},
                ${fluidRep.share_guid || null}, ${fluidRep.image_url || null},
                ${fluidRep.roles || 'user'}, ${fluidRep.country_code || null},
                ${fluidRep.language_code || null}, ${fluidRep.computed_full_name || null},
                ${fluidRep.computed_email || null}, ${fluidRep.customer_id || null},
                NOW(), NOW()
              )
              ON CONFLICT ("installationId", "fluidRepId")
              DO UPDATE SET
                "firstName" = EXCLUDED."firstName",
                "lastName" = EXCLUDED."lastName",
                email = EXCLUDED.email,
                phone = EXCLUDED.phone,
                active = EXCLUDED.active,
                "externalId" = EXCLUDED."externalId",
                username = EXCLUDED.username,
                "shareGuid" = EXCLUDED."shareGuid",
                "imageUrl" = EXCLUDED."imageUrl",
                roles = EXCLUDED.roles,
                "countryCode" = EXCLUDED."countryCode",
                "languageCode" = EXCLUDED."languageCode",
                "computedFullName" = EXCLUDED."computedFullName",
                "computedEmail" = EXCLUDED."computedEmail",
                "customerId" = EXCLUDED."customerId",
                "updatedAt" = NOW()
            `
            syncedCount++
          } catch (error) {
            console.error(`Error syncing rep ${fluidRep.id}:`, error)
            errorCount++
          }
        }

        // Check if there are more pages
        if (fluidResponse.meta.pagination) {
          hasMorePages = page < fluidResponse.meta.pagination.total_pages
          page++
        } else {
          hasMorePages = false
        }
      }

      return { synced: syncedCount, errors: errorCount }
    } catch (error) {
      console.error('Error syncing reps from Fluid:', error)
      throw error
    }
  }

  /**
   * Get reps from our database for an installation
   */
  static async getRepsForInstallation(installationId: string) {
    console.log(`🔍 Querying reps for installationId: ${installationId}`)

    const reps = await prisma.$queryRaw`
      SELECT * FROM reps
      WHERE "installationId" = ${installationId}
      ORDER BY "updatedAt" DESC
    `

    console.log(`👥 Found ${Array.isArray(reps) ? reps.length : 0} reps`)

    return reps
  }

  /**
   * Get a single rep by Fluid ID
   */
  static async getRepByFluidId(installationId: string, fluidRepId: string) {
    const result = await prisma.$queryRaw`
      SELECT * FROM reps
      WHERE "installationId" = ${installationId} AND "fluidRepId" = ${fluidRepId}
      LIMIT 1
    `
    return Array.isArray(result) && result.length > 0 ? result[0] : null
  }
}

import { FastifyInstance } from 'fastify'
import { RepService } from '../services/repService'
import { prisma } from '../db'

export async function repRoutes(fastify: FastifyInstance) {
  // Get reps for an installation (from our database)
  fastify.get('/api/reps/:installationId', async (request, reply) => {
    try {
      const { installationId } = request.params as { installationId: string }

      // Verify installation exists and is active
      const installationResult = await prisma.$queryRaw`
        SELECT i.*, c.name as "companyName", c."logoUrl" as "companyLogoUrl", c."fluidShop"
        FROM installations i
        JOIN companies c ON i."companyId" = c.id
        WHERE i."fluidId" = ${installationId} AND i."isActive" = true
        LIMIT 1
      `
      const installation = Array.isArray(installationResult) && installationResult.length > 0
        ? installationResult[0]
        : null

      if (!installation) {
        return reply.status(404).send({
          success: false,
          message: 'Installation not found or inactive'
        })
      }

      fastify.log.info(`🔍 GET /api/reps - Looking up reps for installation.id: ${(installation as any).id}`)

      const reps = await RepService.getRepsForInstallation((installation as any).id)

      return reply.send({
        success: true,
        data: {
          reps,
          installation: {
            id: installation.fluidId,
            companyName: installation.companyName
          }
        }
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        message: 'Failed to fetch reps'
      })
    }
  })

  // Sync reps from Fluid API to our database
  fastify.post('/api/reps/:installationId/sync', async (request, reply) => {
    try {
      const { installationId } = request.params as { installationId: string }

      // Get installation details
      const installationResult = await prisma.$queryRaw`
        SELECT i.*, c.name as "companyName", c."logoUrl" as "companyLogoUrl", c."fluidShop"
        FROM installations i
        JOIN companies c ON i."companyId" = c.id
        WHERE i."fluidId" = ${installationId} AND i."isActive" = true
        LIMIT 1
      `
      const installation = Array.isArray(installationResult) && installationResult.length > 0
        ? installationResult[0]
        : null

      if (!installation) {
        return reply.status(404).send({
          success: false,
          message: 'Installation not found or inactive'
        })
      }

      if (!(installation as any).authenticationToken) {
        return reply.status(400).send({
          success: false,
          message: 'No authentication token available for this installation'
        })
      }

      // Get company subdomain from stored fluidShop
      const fluidShop = (installation as any).fluidShop
      if (!fluidShop) {
        return reply.status(400).send({
          success: false,
          message: 'Company Fluid shop domain not found. Please reinstall the droplet.'
        })
      }

      // Extract subdomain (e.g., "droplets" from "droplets.fluid.app")
      const companyShop = fluidShop.replace('.fluid.app', '')

      // Sync reps from Fluid
      const syncResult = await RepService.syncRepsFromFluid(
        installation.id,
        companyShop,
        (installation as any).authenticationToken
      )

      return reply.send({
        success: true,
        data: {
          message: `Successfully synced ${syncResult.synced} reps from Fluid`,
          synced: syncResult.synced,
          errors: syncResult.errors,
          installation: {
            id: installation.fluidId,
            companyName: installation.companyName
          }
        }
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        message: 'Failed to sync reps from Fluid'
      })
    }
  })

  // Test reps from Fluid API (for testing token functionality)
  fastify.get('/api/reps/:installationId/fluid', async (request, reply) => {
    try {
      const { installationId } = request.params as { installationId: string }

      // Get installation details
      const installationResult = await prisma.$queryRaw`
        SELECT i.*, c.name as "companyName", c."logoUrl" as "companyLogoUrl", c."fluidShop"
        FROM installations i
        JOIN companies c ON i."companyId" = c.id
        WHERE i."fluidId" = ${installationId} AND i."isActive" = true
        LIMIT 1
      `
      const installation = Array.isArray(installationResult) && installationResult.length > 0
        ? installationResult[0]
        : null

      if (!installation) {
        return reply.status(404).send({
          success: false,
          message: 'Installation not found or inactive'
        })
      }

      if (!(installation as any).authenticationToken) {
        return reply.status(400).send({
          success: false,
          message: 'No authentication token available for this installation'
        })
      }

      // Get company subdomain from stored fluidShop
      const fluidShop = (installation as any).fluidShop
      if (!fluidShop) {
        return reply.status(400).send({
          success: false,
          message: 'Company Fluid shop domain not found. Please reinstall the droplet.'
        })
      }

      // Extract subdomain
      const companyShop = fluidShop.replace('.fluid.app', '')

      // Fetch reps directly from Fluid API
      const fluidResponse = await RepService.fetchRepsFromFluid(
        companyShop,
        (installation as any).authenticationToken,
        1,
        10 // Limit to 10 for testing
      )

      return reply.send({
        success: true,
        data: {
          reps: fluidResponse.reps,
          meta: fluidResponse.meta,
          installation: {
            id: installation.fluidId,
            companyName: installation.companyName
          }
        }
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        message: 'Failed to fetch reps from Fluid API'
      })
    }
  })
}

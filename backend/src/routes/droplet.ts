import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from '../db'

export async function dropletRoutes(fastify: FastifyInstance) {
  // Get installation details including authentication token (for Fluid integration)
  fastify.get('/api/droplet/installation/:installationId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { installationId } = request.params as { installationId: string };


      const installation = await prisma.installation.findUnique({
        where: { fluidId: installationId },
        include: { company: true }
      });

      if (!installation) {
        fastify.log.warn(`Installation not found: ${installationId}`);
        return reply.status(404).send({ error: 'Installation not found' });
      }

      if (!installation.isActive) {
        fastify.log.warn(`Installation inactive: ${installationId}`);
        return reply.status(403).send({ error: 'Installation is inactive' });
      }

      const result = {
        data: {
          companyName: installation.company.name,
          logoUrl: installation.company.logoUrl,
          installationId: installation.fluidId,
          isActive: installation.isActive
        }
      };

      return result;
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get brand guidelines for an installation
  fastify.get('/api/droplet/brand-guidelines/:installationId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { installationId } = request.params as { installationId: string };
      const { fluid_api_key } = request.query as { fluid_api_key: string };


      if (!fluid_api_key) {
        fastify.log.warn('Brand guidelines request missing fluid_api_key');
        return reply.status(400).send({ error: 'Fluid API key required' });
      }

      // Validate the authentication token format
      if (!fluid_api_key.startsWith('dit_') && !fluid_api_key.startsWith('cdrtkn_')) {
        fastify.log.warn(`Invalid API key format: ${fluid_api_key.substring(0, 10)}...`);
        return reply.status(400).send({ error: 'Invalid authentication token format' });
      }

      // Find the installation
      const installation = await prisma.installation.findUnique({
        where: { fluidId: installationId },
        include: { company: true }
      });

      if (!installation) {
        fastify.log.warn(`Installation not found for brand guidelines: ${installationId}`);
        return reply.status(404).send({ error: 'Installation not found' });
      }

      if (!installation.isActive) {
        fastify.log.warn(`Installation inactive for brand guidelines: ${installationId}`);
        return reply.status(403).send({ error: 'Installation is inactive' });
      }

      try {
        // Fetch brand guidelines from Fluid API
        // Note: We don't store the fluid_shop in our database, so we'll use the main Fluid API
        const fluidApiUrl = `https://fluid.app/api/settings/brand_guidelines`;

        // info logs removed

        const response = await fetch(fluidApiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${fluid_api_key}`,
            'Content-Type': 'application/json'
          }
        });

        // info logs removed

        if (!response.ok) {
          const errorText = await response.text();
          fastify.log.warn(`Fluid API error response: ${errorText}`);
          throw new Error(`Fluid API error: ${response.status} - ${errorText}`);
        }

        const brandData: any = await response.json();
        // info logs removed

        const result = {
          data: {
            name: brandData.name || installation.company.name,
            logo_url: brandData.logo_url || installation.company.logoUrl,
            color: brandData.color || '#2563eb',
            secondary_color: brandData.secondary_color || '#1d4ed8',
            icon_url: brandData.icon_url,
            favicon_url: brandData.favicon_url
          }
        };

        return result;
      } catch (fetchError) {
        const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error';
        fastify.log.warn(`Failed to fetch brand guidelines from Fluid API: ${errorMessage}`);

        // Fallback to basic company information
        const brandGuidelines = {
          name: installation.company.name,
          logo_url: installation.company.logoUrl,
          color: '#2563eb', // Default blue fallback
          secondary_color: '#1d4ed8'
        };

        const result = {
          data: brandGuidelines
        };

        return result;
      }
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get company authentication token for API operations
  fastify.get('/api/droplet/auth-token/:installationId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { installationId } = request.params as { installationId: string };
      const { fluid_api_key } = request.query as { fluid_api_key: string };


      if (!fluid_api_key) {
        fastify.log.warn('Auth token request missing fluid_api_key');
        return reply.status(400).send({ error: 'Fluid API key required' });
      }

      // Validate the authentication token format
      if (!fluid_api_key.startsWith('dit_') && !fluid_api_key.startsWith('cdrtkn_')) {
        fastify.log.warn(`Invalid API key format: ${fluid_api_key.substring(0, 10)}...`);
        return reply.status(400).send({ error: 'Invalid authentication token format' });
      }

      // Find the installation using the correct database schema
      const installation = await prisma.$queryRaw`
        SELECT
          i.id,
          i."fluidId",
          i."isActive",
          i."authenticationToken",
          c.name as "companyName"
        FROM installations i
        JOIN companies c ON i."companyId" = c.id
        WHERE i."fluidId" = ${installationId}
      ` as any[];

      if (!installation || installation.length === 0) {
        fastify.log.warn(`Installation not found for auth token: ${installationId}`);
        return reply.status(404).send({ error: 'Installation not found' });
      }

      const installData = installation[0];

      if (!installData.isActive) {
        fastify.log.warn(`Installation inactive for auth token: ${installationId}`);
        return reply.status(403).send({ error: 'Installation is inactive' });
      }

      if (!installData.authenticationToken) {
        fastify.log.warn(`No authentication token found for installation: ${installationId}`);
        return reply.status(404).send({ error: 'Authentication token not available' });
      }

      const result = {
        data: {
          installationId: installData.fluidId,
          companyName: installData.companyName,
          authenticationToken: installData.authenticationToken,
          tokenType: 'dit_',
          usage: 'Use this token to authenticate API calls on behalf of the company'
        }
      };

      return result;
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Debug endpoint to check registered webhooks
  fastify.get('/api/droplet/debug/webhooks/:installationId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { installationId } = request.params as { installationId: string };

      // Get installation details
      const installation = await prisma.$queryRaw`
        SELECT i.id, i."fluidId", i."authenticationToken", c.name as "companyName", c."fluidShop"
        FROM installations i
        JOIN companies c ON i."companyId" = c.id
        WHERE i."fluidId" = ${installationId} AND i."isActive" = true
        LIMIT 1
      ` as any[];

      if (!installation || installation.length === 0) {
        return reply.status(404).send({ 
          error: 'Installation not found',
          installationId: installationId
        });
      }

      const install = installation[0];
      const authToken = install.authenticationToken;

      if (!authToken) {
        return reply.status(400).send({ 
          error: 'No authentication token available',
          installationId: installationId
        });
      }

      // Try to list webhooks from Fluid API
      try {
        const subdomain = install.fluidShop.replace('.fluid.app', '');
        const webhookUrl = `https://${subdomain}.fluid.app/api/company/webhooks`;
        
        const response = await fetch(webhookUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const webhooks = await response.json();
          return reply.send({
            success: true,
            installationId: installationId,
            companyName: install.companyName,
            fluidShop: install.fluidShop,
            webhookUrl: webhookUrl,
            registeredWebhooks: webhooks,
            webhookCount: Array.isArray(webhooks) ? webhooks.length : 0
          });
        } else {
          const errorText = await response.text();
          return reply.status(response.status).send({
            error: 'Failed to fetch webhooks from Fluid API',
            status: response.status,
            response: errorText,
            webhookUrl: webhookUrl
          });
        }
      } catch (apiError) {
        return reply.status(500).send({
          error: 'Failed to call Fluid API',
          details: apiError,
          webhookUrl: `https://${install.fluidShop.replace('.fluid.app', '')}.fluid.app/api/company/webhooks`
        });
      }

    } catch (error) {
      fastify.log.error(`Webhook debug failed: ${error}`);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Manual installation endpoint - fallback for when webhooks fail
  fastify.post('/api/droplet/install/:installationId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { installationId } = request.params as { installationId: string };
      const { fluid_api_key, company_name, fluid_shop } = request.body as { 
        fluid_api_key: string; 
        company_name: string; 
        fluid_shop: string; 
      };

      if (!fluid_api_key || !company_name || !fluid_shop) {
        return reply.status(400).send({ 
          error: 'Missing required fields: fluid_api_key, company_name, fluid_shop' 
        });
      }

      // Check if installation already exists
      const existingInstallation = await prisma.$queryRaw`
        SELECT i.id, i."fluidId", i."isActive"
        FROM installations i
        WHERE i."fluidId" = ${installationId}
      ` as any[];

      if (existingInstallation && existingInstallation.length > 0) {
        return reply.send({ 
          success: true, 
          message: 'Installation already exists',
          installationId: installationId
        });
      }

      // Create company
      const companyRecord = await prisma.$queryRaw`
        INSERT INTO companies (id, "fluidId", name, "logoUrl", "fluidShop", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), ${Math.floor(Math.random() * 1000000000)}, ${company_name}, null, ${fluid_shop}, NOW(), NOW())
        RETURNING id, "fluidId", name, "fluidShop"
      ` as any[];

      const companyData = companyRecord[0];

      // Create installation
      const installationResult = await prisma.$queryRaw`
        INSERT INTO installations (
          id, "companyId", "fluidId", "authenticationToken",
          "webhookVerificationToken", "companyDropletUuid", "isActive", "createdAt", "updatedAt"
        )
        VALUES (
          gen_random_uuid(), ${companyData.id}, ${installationId}, ${fluid_api_key},
          null, null, true, NOW(), NOW()
        )
        RETURNING id, "fluidId", "isActive"
      ` as any[];

      fastify.log.info(`✅ Manual installation created: ${installationId} for ${company_name}`);

      return reply.send({ 
        success: true, 
        message: 'Installation created successfully',
        installationId: installationId,
        companyName: company_name
      });

    } catch (error) {
      fastify.log.error(`Manual installation failed: ${error}`);
      return reply.status(500).send({ error: 'Failed to create installation' });
    }
  });

  // Get company dashboard data
  fastify.get('/api/droplet/dashboard/:installationId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { installationId } = request.params as { installationId: string };
      const { fluid_api_key } = request.query as { fluid_api_key: string };

      // If API key is provided, validate it
      if (fluid_api_key) {
        // Validate the authentication token format (should start with 'dit_' or 'cdrtkn_')
        if (!fluid_api_key.startsWith('dit_') && !fluid_api_key.startsWith('cdrtkn_')) {
          fastify.log.warn(`Invalid API key format: ${fluid_api_key.substring(0, 10)}...`);
          return reply.status(400).send({ error: 'Invalid authentication token format' });
        }
      }

      // Find the exact installation ID - NO FALLBACKS (security)
      const installation = await prisma.$queryRaw`
        SELECT
          i.id,
          i."fluidId",
          i."isActive",
          i."authenticationToken",
          i."webhookVerificationToken",
          i."companyDropletUuid",
          c.name as "companyName",
          c."logoUrl",
          c."fluidShop"
        FROM installations i
        JOIN companies c ON i."companyId" = c.id
        WHERE i."fluidId" = ${installationId}
      ` as any[];

      if (!installation || installation.length === 0) {
        fastify.log.warn(`Installation not found: ${installationId}`);
        return reply.status(404).send({ 
          error: 'Installation not found',
          message: 'This installation was not found in our database. This usually means the installation webhook was not received or failed to process.',
          installationId: installationId,
          suggestion: 'Try reinstalling the droplet from the Fluid marketplace, or contact support if the issue persists.'
        });
      }

      const installData = installation[0];

      if (!installData.isActive) {
        fastify.log.warn(`Installation inactive: ${installationId}`);
        return reply.status(403).send({ error: 'Installation is inactive' });
      }

      const result = {
        data: {
          companyName: installData.companyName,
          logoUrl: installData.logoUrl,
          installationId: installData.fluidId,
          authenticationToken: installData.authenticationToken, // Include the dit_ token
          webhookVerificationToken: installData.webhookVerificationToken, // Include webhook verification token
          companyDropletUuid: installData.companyDropletUuid, // Include company droplet UUID
          fluidShop: installData.fluidShop, // Include the company's Fluid shop domain
          // Token availability info
          tokenInfo: {
            hasAuthToken: !!installData.authenticationToken,
            hasWebhookToken: !!installData.webhookVerificationToken,
            authTokenType: installData.authenticationToken ?
              (installData.authenticationToken.startsWith('dit_') ? 'droplet_installation_token' :
                installData.authenticationToken.startsWith('cdrtkn_') ? 'company_droplet_token' : 'unknown') : null
          }
        }
      };

      return result;
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

}
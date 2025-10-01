import { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { WebhookRegistrationService } from '../services/webhookRegistration'

interface FluidProduct {
  id: number
  title: string
  variants?: any[]
}

interface FluidProductsResponse {
  products: FluidProduct[]
}

interface FluidCart {
  cart_token: string
}

interface FluidCheckoutResponse {
  order?: any
  checkout?: any
  [key: string]: any
}

export async function testWebhookRoutes(fastify: FastifyInstance) {
  // List registered webhooks for an installation
  fastify.get('/api/test-webhook/:installationId/list', async (request, reply) => {
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

      const DIT_TOKEN = (installation as any).authenticationToken

      fastify.log.info(`Listing webhooks for installation: ${installationId}`)

      try {
        const webhooks = await WebhookRegistrationService.listWebhooks(DIT_TOKEN, fastify.log)

        return reply.send({
          success: true,
          message: `Found ${webhooks.length} registered webhooks`,
          data: {
            webhookCount: webhooks.length,
            webhooks: webhooks.map(w => ({
              id: w.webhook.id,
              resource: w.webhook.resource,
              event: w.webhook.event,
              url: w.webhook.url,
              active: w.webhook.active,
              created_at: w.webhook.created_at
            }))
          }
        })
      } catch (error: any) {
        fastify.log.error(`Error listing webhooks: ${error.message}`)
        return reply.status(500).send({
          success: false,
          message: `Failed to list webhooks: ${error.message}`
        })
      }
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        message: 'Failed to list webhooks'
      })
    }
  })

  // Test webhook by creating a product in Fluid
  fastify.post('/api/test-webhook/:installationId/product', async (request, reply) => {
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

      const SHOP = fluidShop
      const DIT_TOKEN = (installation as any).authenticationToken

      fastify.log.info(`Creating test product for ${SHOP} using token ${DIT_TOKEN.substring(0, 15)}...`)

      try {
        // Create a test product
        const timestamp = Date.now()
        const productPayload = {
          product: {
            title: `Test Product ${timestamp}`,
            sku: `TEST-${timestamp}`,
            description: 'This is a test product created by the webhook tester',
            status: 'active',
            publish_to_retail_store: true,
            publish_to_rep_store: true,
            publish_to_share_tab: true,
            variants_attributes: [
              {
                title: 'Default',
                is_master: true,
                track_quantity: false,
                variant_countries_attributes: [
                  {
                    active: true,
                    country_id: 214, // United States
                    price: 10.00
                  }
                ]
              }
            ]
          }
        }

        const createProductResponse = await fetch(`https://${SHOP}/api/company/v1/products`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${DIT_TOKEN}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(productPayload)
        })

        if (!createProductResponse.ok) {
          const errorText = await createProductResponse.text()
          throw new Error(`Failed to create test product: ${createProductResponse.status} - ${errorText}`)
        }

        const productData = await createProductResponse.json() as any
        fastify.log.info(`✅ Product created successfully! ID: ${productData.product?.id}`)

        return reply.send({
          success: true,
          message: 'Test product created successfully! The webhook should arrive shortly.',
          data: {
            shop: SHOP,
            productId: productData.product?.id,
            productTitle: productData.product?.title,
            productResponse: productData,
            webhookNote: 'Webhook delivery may take 5-30 seconds. Check your backend logs for webhook delivery.',
            troubleshooting: 'If the product does not appear after 30 seconds, check that webhooks are configured in your Fluid droplet settings.'
          }
        })
      } catch (error: any) {
        fastify.log.error(`Error creating test product: ${error.message}`)
        return reply.status(500).send({
          success: false,
          message: `Failed to create test product: ${error.message}`
        })
      }
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        message: 'Failed to create test webhook product'
      })
    }
  })

  // Test webhook by creating an order in Fluid
  fastify.post('/api/test-webhook/:installationId/order', async (request, reply) => {
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

      const SHOP = fluidShop
      const DIT_TOKEN = (installation as any).authenticationToken
      const API_HOST = 'https://api.fluid.app'

      fastify.log.info(`Creating test order for ${SHOP} using token ${DIT_TOKEN.substring(0, 15)}...`)

      let responseLog: any = {}

      try {
        // Step 1: Find a variant or create a simple product if none exist
        fastify.log.info('Step 1: Finding or creating a product variant...')
        let variantId: number | null = null

        const productsResponse = await fetch(`https://${SHOP}/api/company/v1/products?per_page=50`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${DIT_TOKEN}`,
            'Accept': 'application/json'
          }
        })

        if (!productsResponse.ok) {
          throw new Error(`Failed to fetch products: ${productsResponse.status}`)
        }

        const productsData = await productsResponse.json() as FluidProductsResponse
        responseLog.productsFound = productsData.products?.length || 0

        // Try to find a variant from existing products
        for (const product of productsData.products || []) {
          if (product.variants && product.variants.length > 0) {
            variantId = product.variants[0].id
            break
          }
        }

        // If no variant found, create a test product
        if (!variantId) {
          fastify.log.info('No variants found, creating test product...')
          const createProductResponse = await fetch(`https://${SHOP}/api/company/v1/products`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${DIT_TOKEN}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              product: {
                title: 'Test Product for Webhook',
                status: 'active',
                publish_to_retail_store: true,
                publish_to_rep_store: true,
                publish_to_share_tab: true,
                variants_attributes: [
                  {
                    title: 'Default',
                    is_master: true,
                    track_quantity: false,
                    variant_countries_attributes: [
                      { active: true, country_id: 214, price: 10 }
                    ]
                  }
                ]
              }
            })
          })

          if (!createProductResponse.ok) {
            const errorText = await createProductResponse.text()
            throw new Error(`Failed to create test product: ${createProductResponse.status} - ${errorText}`)
          }

          // Fetch products again to get the new variant ID
          const newProductsResponse = await fetch(`https://${SHOP}/api/company/v1/products?per_page=50`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${DIT_TOKEN}`,
              'Accept': 'application/json'
            }
          })

          if (newProductsResponse.ok) {
            const newProductsData = await newProductsResponse.json() as FluidProductsResponse
            for (const product of newProductsData.products || []) {
              if (product.variants && product.variants.length > 0) {
                variantId = product.variants[0].id
                break
              }
            }
          }
        }

        if (!variantId) {
          throw new Error('Failed to find or create a product variant')
        }

        responseLog.variantId = variantId
        fastify.log.info(`Using variant ID: ${variantId}`)

        // Step 2: Create a cart
        fastify.log.info('Step 2: Creating cart...')
        const createCartResponse = await fetch(`${API_HOST}/api/public/v2025-06/commerce/carts`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            country_code: 'US',
            fluid_shop: SHOP
          })
        })

        if (!createCartResponse.ok) {
          const errorText = await createCartResponse.text()
          throw new Error(`Failed to create cart: ${createCartResponse.status} - ${errorText}`)
        }

        const cartData = await createCartResponse.json() as { cart: FluidCart }
        const cartToken = cartData.cart.cart_token
        responseLog.cartToken = cartToken
        fastify.log.info(`Cart created: ${cartToken}`)

        // Step 3: Add items to cart
        fastify.log.info('Step 3: Adding items to cart...')
        const addItemsResponse = await fetch(`${API_HOST}/api/public/v2025-06/commerce/carts/${cartToken}/items`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            items: [{ variant_id: variantId, quantity: 1 }],
            metadata: { fluid_shop: SHOP }
          })
        })

        if (!addItemsResponse.ok) {
          const errorText = await addItemsResponse.text()
          throw new Error(`Failed to add items to cart: ${addItemsResponse.status} - ${errorText}`)
        }
        fastify.log.info('Items added to cart')

        // Step 4: Set customer email
        fastify.log.info('Step 4: Setting customer email...')
        const setEmailResponse = await fetch(`${API_HOST}/api/public/v2025-06/commerce/carts/${cartToken}`, {
          method: 'PATCH',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: 'customer@example.com'
          })
        })

        if (!setEmailResponse.ok) {
          const errorText = await setEmailResponse.text()
          throw new Error(`Failed to set email: ${setEmailResponse.status} - ${errorText}`)
        }
        fastify.log.info('Customer email set')

        // Step 5: Add shipping and billing addresses
        fastify.log.info('Step 5: Adding addresses...')
        const address = {
          first_name: 'John',
          last_name: 'Doe',
          address1: '123 Main St',
          city: 'Portland',
          state: 'OR',
          postal_code: '97205',
          country_id: 214,
          country_code: 'US'
        }

        // Ship-to address
        const shipToResponse = await fetch(`${API_HOST}/api/public/v2025-06/commerce/carts/${cartToken}/address`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: 'ship_to',
            address
          })
        })

        if (!shipToResponse.ok) {
          const errorText = await shipToResponse.text()
          throw new Error(`Failed to add ship-to address: ${shipToResponse.status} - ${errorText}`)
        }

        // Bill-to address
        const billToResponse = await fetch(`${API_HOST}/api/public/v2025-06/commerce/carts/${cartToken}/address`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: 'bill_to',
            address
          })
        })

        if (!billToResponse.ok) {
          const errorText = await billToResponse.text()
          throw new Error(`Failed to add bill-to address: ${billToResponse.status} - ${errorText}`)
        }
        fastify.log.info('Addresses added')

        // Step 6: Set shipping method
        fastify.log.info('Step 6: Setting shipping method...')
        const shippingMethodResponse = await fetch(`${API_HOST}/api/public/v2025-06/commerce/carts/${cartToken}/shipping_method`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            shipping_method_id: 'manual-shipping'
          })
        })

        if (!shippingMethodResponse.ok) {
          const errorText = await shippingMethodResponse.text()
          throw new Error(`Failed to set shipping method: ${shippingMethodResponse.status} - ${errorText}`)
        }
        fastify.log.info('Shipping method set')

        // Step 7: Add payment method
        fastify.log.info('Step 7: Adding payment method...')
        const paymentResponse = await fetch(`${API_HOST}/api/public/v2025-06/commerce/carts/${cartToken}/payment_methods/credit_card`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            billing_postal_code: '97205',
            payment_method: {
              token: 'test_card_token',
              last_four: '4242',
              card_type: 'visa',
              exp_month: '12',
              exp_year: '2030'
            }
          })
        })

        if (!paymentResponse.ok) {
          const errorText = await paymentResponse.text()
          throw new Error(`Failed to add payment method: ${paymentResponse.status} - ${errorText}`)
        }
        fastify.log.info('Payment method added')

        // Step 8: Checkout
        fastify.log.info('Step 8: Checking out...')
        const checkoutResponse = await fetch(`${API_HOST}/api/public/v2025-06/commerce/carts/${cartToken}/checkout`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        })

        if (!checkoutResponse.ok) {
          const errorText = await checkoutResponse.text()
          throw new Error(`Failed to checkout: ${checkoutResponse.status} - ${errorText}`)
        }

        const checkoutData = await checkoutResponse.json() as FluidCheckoutResponse
        responseLog.checkoutResponse = checkoutData
        fastify.log.info('✅ Order created successfully!')

        return reply.send({
          success: true,
          message: 'Test order created successfully! The webhook should arrive shortly.',
          data: {
            shop: SHOP,
            variantId,
            cartToken,
            checkoutResponse: checkoutData,
            orderId: checkoutData.order?.id || checkoutData.checkout?.id || 'unknown',
            webhookNote: 'Webhook delivery may take 5-30 seconds. Check your backend logs for: 🛒 === ORDER WEBHOOK DETECTED ===',
            troubleshooting: 'If the order does not appear after 30 seconds, check that webhooks are configured in your Fluid droplet settings.'
          }
        })
      } catch (error: any) {
        fastify.log.error(`Error creating test order: ${error.message}`)
        return reply.status(500).send({
          success: false,
          message: `Failed to create test order: ${error.message}`,
          debug: responseLog
        })
      }
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        message: 'Failed to create test webhook order'
      })
    }
  })
}

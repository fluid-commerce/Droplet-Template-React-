import { prisma } from '../db'

export interface FluidProduct {
  id: number
  title: string
  sku?: string
  description?: string
  image_url?: string
  imageUrl?: string
  image?: string
  images?: any[]
  status?: string
  price?: string
  in_stock?: boolean
  public?: boolean
  [key: string]: any // Allow for additional fields from Fluid API
}

export interface FluidProductsResponse {
  products: FluidProduct[]
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

export interface FluidOrder {
  id: number
  order_number?: string
  amount?: string
  status?: string
  created_at?: string
  customer?: {
    email?: string
    first_name?: string
    last_name?: string
    name?: string
  }
  items_count?: number
  [key: string]: any // Allow for additional fields from Fluid API
}

export interface FluidOrdersResponse {
  orders: FluidOrder[]
  meta: {
    request_id: string
    timestamp: string
    current_page?: number
    total_count?: number
    pagination?: {
      page: number
      per_page: number
      total_pages: number
      total_count: number
    }
  }
}

export class ProductService {
  /**
   * Fetch products from Fluid API
   */
  static async fetchProductsFromFluid(
    companyShop: string,
    authToken: string,
    page: number = 1,
    perPage: number = 50
  ): Promise<FluidProductsResponse> {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
      status: 'active' // Only fetch active products
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    try {
      // Try multiple API endpoints to find the correct one
      const possibleEndpoints = [
        `https://${companyShop}.fluid.app/api/company/v1/products?${queryParams}`, // Original
        `https://app.nexui.com/api/company/v1/products?company=${companyShop}&${queryParams}`, // New API base from dashboard
        `https://app.nexui.com/api/companies/${companyShop}/products?${queryParams}`, // Alternative structure
        `https://api.fluid.app/api/company/v1/products?company=${companyShop}&${queryParams}` // Global API fallback
      ];

      let response = null;

      for (const endpoint of possibleEndpoints) {
        console.log(`🔍 Trying products API endpoint: ${endpoint}`);

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
            console.log(`✅ Success with products endpoint: ${endpoint}`);
            break;
          } else {
            console.log(`❌ Failed with ${endpoint}: ${response.status} ${response.statusText}`);
            // Try to get response body for more details
            try {
              const errorBody = await response.text();
              console.log(`❌ Error response body: ${errorBody}`);
            } catch (bodyError) {
              console.log(`❌ Could not read error response body`);
            }
          }
        } catch (endpointError: any) {
          console.log(`❌ Error with ${endpoint}: ${endpointError?.message || endpointError}`);
          console.log(`❌ Error type: ${endpointError?.name}`);
          console.log(`❌ Error code: ${endpointError?.code}`);
          if (endpointError?.cause) {
            console.log(`❌ Error cause: ${endpointError.cause}`);
          }
        }
      }

      if (!response || !response.ok) {
        throw new Error(`All product API endpoints failed. Last status: ${response?.status || 'No response'}`);
      }

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`Failed to fetch products from Fluid: ${response.status} ${response.statusText}`)
      }

      const raw = await response.json()

      // Normalize possible response shapes:
      // 1) { products: [...], meta: {...} }
      // 2) { status: 'success', data: { products: [...], meta?: {...} } }
      // 3) Flat list, rare fallback
      const products = raw?.products || raw?.data?.products || []
      const meta = raw?.meta || raw?.data?.meta || raw?.data || raw

      return { products, meta }
    } catch (error: any) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        throw new Error('Request timeout: Fluid API took too long to respond')
      }
      throw error
    }
  }

  /**
   * Fetch product images from Fluid API
   */
  static async fetchProductImages(
    companyShop: string,
    authToken: string,
    productId: number
  ): Promise<string | null> {
    try {
      const possibleEndpoints = [
        `https://${companyShop}.fluid.app/api/company/v1/products/${productId}/images`,
        `https://app.nexui.com/api/company/v1/products/${productId}/images?company=${companyShop}`,
        `https://api.fluid.app/api/company/v1/products/${productId}/images?company=${companyShop}`
      ]
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout for images

      let imageUrl: string | null = null
      for (const endpoint of possibleEndpoints) {
        try {
          const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            },
            signal: controller.signal
          })
          if (!response.ok) continue

          const data = await response.json()
          // Normalize shapes: { images: [...] } or { status: 'success', data: { images: [...] } }
          const images = data?.images || data?.data?.images || []
          if (Array.isArray(images) && images.length > 0) {
            const sortedImages = images.sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
            imageUrl = sortedImages[0]?.image_url || sortedImages[0]?.url || null
            if (imageUrl) break
          }
        } catch (e) {
          // try next endpoint
        }
      }

      clearTimeout(timeoutId)
      return imageUrl
    } catch (error: any) {
      // If there's any error fetching images, just return null
      return null
    }
  }

  /**
   * Sync products from Fluid to our database
   */
  static async syncProductsFromFluid(
    installationId: string,
    companyShop: string,
    authToken: string
  ): Promise<{ synced: number; errors: number }> {
    try {
      // Fetch all products from Fluid (with pagination)
      let page = 1
      let hasMorePages = true
      let syncedCount = 0
      let errorCount = 0

      while (hasMorePages) {
        const fluidResponse = await this.fetchProductsFromFluid(companyShop, authToken, page, 50)
        
        // Process each product
        for (const fluidProduct of fluidResponse.products) {
          try {
            // Debug: Log first few products to check image URLs
            if (syncedCount < 3) {
              console.log(`Product ${fluidProduct.id} image_url:`, fluidProduct.image_url)
              console.log(`Product ${fluidProduct.id} full data:`, JSON.stringify(fluidProduct, null, 2))
            }
            
            // Prefer image fields present on the product payload to avoid extra calls
            let imageUrl = (
              fluidProduct.image_url ||
              fluidProduct.imageUrl ||
              fluidProduct.image ||
              (Array.isArray(fluidProduct.images) && fluidProduct.images.length > 0
                ? (fluidProduct.images[0]?.image_url || fluidProduct.images[0]?.url || null)
                : null)
            ) as string | null

            // Fallback: fetch images from images endpoint only if not present
            if (!imageUrl) {
              imageUrl = await ProductService.fetchProductImages(companyShop, authToken, fluidProduct.id)
            }
            
            if (syncedCount < 3) {
              console.log(`Product ${fluidProduct.id} fetched image URL:`, imageUrl)
            }

            await prisma.$executeRaw`
              INSERT INTO products (
                id, "installationId", "fluidProductId", title, sku, description, 
                "imageUrl", status, price, "inStock", public, "createdAt", "updatedAt"
              ) VALUES (
                gen_random_uuid(), ${installationId}, ${fluidProduct.id.toString()}, 
                ${fluidProduct.title}, ${fluidProduct.sku || null}, ${fluidProduct.description || null},
                ${imageUrl}, ${fluidProduct.status || null}, 
                ${fluidProduct.price || null}, ${fluidProduct.in_stock ?? true}, 
                ${fluidProduct.public ?? true}, NOW(), NOW()
              )
              ON CONFLICT ("installationId", "fluidProductId") 
              DO UPDATE SET
                title = EXCLUDED.title,
                sku = EXCLUDED.sku,
                description = EXCLUDED.description,
                "imageUrl" = EXCLUDED."imageUrl",
                status = EXCLUDED.status,
                price = EXCLUDED.price,
                "inStock" = EXCLUDED."inStock",
                public = EXCLUDED.public,
                "updatedAt" = NOW()
            `
            syncedCount++
          } catch (error) {
            console.error(`Error syncing product ${fluidProduct.id}:`, error)
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
      console.error('Error syncing products from Fluid:', error)
      throw error
    }
  }

  /**
   * Get products from our database for an installation
   */
  static async getProductsForInstallation(installationId: string) {
    const products = await prisma.$queryRaw`
      SELECT * FROM products 
      WHERE "installationId" = ${installationId}
      ORDER BY "updatedAt" DESC
    `
    
    // Debug: Log first few products to check imageUrl in database
    if (Array.isArray(products) && products.length > 0) {
      console.log('🔍 Backend: First product from database:', products[0])
      console.log('🔍 Backend: First product imageUrl:', (products[0] as any).imageUrl)
      
      // Check first 3 products for image URLs
      products.slice(0, 3).forEach((product: any, index: number) => {
        console.log(`🔍 Backend: Product ${index + 1} (ID: ${product.fluidProductId}) imageUrl:`, product.imageUrl)
      })
    }
    
    return products
  }

  /**
   * Get a single product by Fluid ID
   */
  static async getProductByFluidId(installationId: string, fluidProductId: string) {
    const result = await prisma.$queryRaw`
      SELECT * FROM products
      WHERE "installationId" = ${installationId} AND "fluidProductId" = ${fluidProductId}
      LIMIT 1
    `
    return Array.isArray(result) && result.length > 0 ? result[0] : null
  }

  /**
   * Sync orders from Fluid to our database
   */
  static async syncOrdersFromFluid(
    installationId: string,
    companyShop: string,
    authToken: string
  ): Promise<{ synced: number; errors: number }> {
    try {
      // Fetch all orders from Fluid (with pagination)
      let page = 1
      let hasMorePages = true
      let syncedCount = 0
      let errorCount = 0

      // Get total pages for progress tracking
      const firstResponse = await this.fetchOrdersFromFluid(companyShop, authToken, 1, 50)
      const totalPages = firstResponse.meta.pagination?.total_pages || 
                        Math.ceil((firstResponse.meta.total_count || 0) / 50)
      
      console.log(`🚀 Starting orders sync: ${firstResponse.meta.total_count || 0} orders across ${totalPages} pages`)

      while (hasMorePages) {
        const fluidResponse = await this.fetchOrdersFromFluid(companyShop, authToken, page, 50)
        
        // Show progress every 10 pages or on first/last page
        if (page === 1 || page % 10 === 0 || page === totalPages) {
          console.log(`📄 Processing page ${page}/${totalPages} (${Math.round((page/totalPages)*100)}%) - ${syncedCount} synced, ${errorCount} errors`)
        }
        
        // Process each order
        for (const fluidOrder of fluidResponse.orders) {
          try {
            // Extract customer information
            const customerEmail = fluidOrder.customer?.email || null
            const customerName = fluidOrder.customer?.name || 
              (fluidOrder.customer?.first_name && fluidOrder.customer?.last_name 
                ? `${fluidOrder.customer.first_name} ${fluidOrder.customer.last_name}` 
                : null)

            await prisma.$executeRaw`
              INSERT INTO orders (
                id, "installationId", "fluidOrderId", "orderNumber", amount, status,
                "customerEmail", "customerName", "itemsCount", "orderData", "createdAt", "updatedAt"
              ) VALUES (
                gen_random_uuid(), ${installationId}, ${fluidOrder.id.toString()}, 
                ${fluidOrder.order_number || null}, ${fluidOrder.amount || null}, ${fluidOrder.status || null},
                ${customerEmail}, ${customerName}, ${fluidOrder.items_count || null},
                ${fluidOrder}::jsonb, NOW(), NOW()
              )
              ON CONFLICT ("installationId", "fluidOrderId") 
              DO UPDATE SET
                "orderNumber" = EXCLUDED."orderNumber",
                amount = EXCLUDED.amount,
                status = EXCLUDED.status,
                "customerEmail" = EXCLUDED."customerEmail",
                "customerName" = EXCLUDED."customerName",
                "itemsCount" = EXCLUDED."itemsCount",
                "orderData" = EXCLUDED."orderData",
                "updatedAt" = NOW()
            `
            syncedCount++
          } catch (error) {
            console.error(`Error syncing order ${fluidOrder.id}:`, error)
            errorCount++
          }
        }

        // Check if there are more pages
        if (fluidResponse.meta.pagination) {
          hasMorePages = page < fluidResponse.meta.pagination.total_pages
          page++
        } else if (fluidResponse.meta.current_page && fluidResponse.meta.total_count) {
          // Fallback to current_page and total_count if pagination object doesn't exist
          const calculatedTotalPages = Math.ceil(fluidResponse.meta.total_count / 50)
          hasMorePages = page < calculatedTotalPages
          page++
        } else {
          hasMorePages = false
        }
      }

      console.log(`✅ Orders sync completed: ${syncedCount} synced, ${errorCount} errors (${totalPages} pages processed)`)
      
      return { synced: syncedCount, errors: errorCount }
    } catch (error) {
      console.error('Error syncing orders from Fluid:', error)
      throw error
    }
  }

  /**
   * Get orders from our database for an installation
   */
  static async getOrdersForInstallation(installationId: string) {
    return await prisma.$queryRaw`
      SELECT * FROM orders 
      WHERE "installationId" = ${installationId}
      ORDER BY "updatedAt" DESC
    `
  }

  /**
   * Fetch orders from Fluid API (for testing token functionality)
   */
  static async fetchOrdersFromFluid(
    companyShop: string,
    authToken: string,
    page: number = 1,
    perPage: number = 10
  ): Promise<FluidOrdersResponse> {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString()
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    try {
      // Try multiple API endpoints for orders
      const possibleEndpoints = [
        `https://${companyShop}.fluid.app/api/v202506/orders?${queryParams}`, // Latest version
        `https://${companyShop}.fluid.app/api/v2/orders?${queryParams}`, // v2 version
        `https://api.fluid.app/api/v2/orders?company=${companyShop}&${queryParams}` // global API
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
          } else {
            console.log(`❌ Orders endpoint failed: ${response.status} ${response.statusText}`);
          }
        } catch (endpointError: any) {
          console.log(`❌ Orders endpoint error: ${endpointError?.message || endpointError}`);
        }
      }

      if (!response || !response.ok) {
        throw new Error(`All orders API endpoints failed. Last status: ${response?.status || 'No response'}`);
      }

      clearTimeout(timeoutId)

      const data = await response.json()
      return data as FluidOrdersResponse
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error) {
        throw new Error(`Failed to fetch orders from Fluid: ${error.message}`)
      }
      throw new Error('Failed to fetch orders from Fluid: Unknown error')
    }
  }
}

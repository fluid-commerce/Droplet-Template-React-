import { FluidClient } from './fluidClient'
import { DropletsClient } from './droplets'
import { FluidConfig } from '@/types'

/**
 * Main client factory for creating Fluid platform clients
 * This provides a centralized way to create and configure all client instances
 */
export class FluidClientFactory {
  private static instance: FluidClientFactory
  private fluidClient: FluidClient | null = null

  private constructor() {}

  static getInstance(): FluidClientFactory {
    if (!FluidClientFactory.instance) {
      FluidClientFactory.instance = new FluidClientFactory()
    }
    return FluidClientFactory.instance
  }

  /**
   * Initialize the Fluid client with configuration
   */
  initialize(config: FluidConfig): void {
    this.fluidClient = new FluidClient(config)
  }

  /**
   * Get the Fluid client instance
   */
  getFluidClient(): FluidClient {
    if (!this.fluidClient) {
      throw new Error('FluidClient not initialized. Call initialize() first.')
    }
    return this.fluidClient
  }

  /**
   * Get the Droplets client
   */
  getDropletsClient(): DropletsClient {
    const fluidClient = this.getFluidClient()
    return new DropletsClient(fluidClient)
  }

  /**
   * Check if the client is initialized
   */
  isInitialized(): boolean {
    return this.fluidClient !== null
  }

  /**
   * Reset the client (useful for testing or reconfiguration)
   */
  reset(): void {
    this.fluidClient = null
  }
}

// Export convenience functions
export const createFluidClient = (config: FluidConfig): FluidClient => {
  const factory = FluidClientFactory.getInstance()
  factory.initialize(config)
  return factory.getFluidClient()
}

export const getDropletsClient = (): DropletsClient => {
  const factory = FluidClientFactory.getInstance()
  return factory.getDropletsClient()
}

// Export the factory instance
export const fluidClientFactory = FluidClientFactory.getInstance()

// Re-export types and classes
export { FluidClient } from './fluidClient'
export { DropletsClient } from './droplets'
export type { FluidConfig } from '@/types'

export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/frontend/test/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/frontend/$1',
    '^@/components/(.*)$': '<rootDir>/frontend/components/$1',
    '^@/lib/(.*)$': '<rootDir>/frontend/lib/$1',
    '^@/types/(.*)$': '<rootDir>/frontend/types/$1',
    '^@/clients/(.*)$': '<rootDir>/frontend/clients/$1',
    '^@/hooks/(.*)$': '<rootDir>/frontend/hooks/$1',
    '^@/utils/(.*)$': '<rootDir>/frontend/utils/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  testMatch: [
    '<rootDir>/frontend/**/__tests__/**/*.(ts|tsx|js)',
    '<rootDir>/frontend/**/*.(test|spec).(ts|tsx|js)',
  ],
  collectCoverageFrom: [
    'frontend/**/*.(ts|tsx)',
    '!frontend/**/*.d.ts',
    '!frontend/main.tsx',
    '!frontend/vite-env.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
}

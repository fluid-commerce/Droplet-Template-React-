import { 
  cn, 
  formatDate, 
  formatRelativeTime, 
  truncateText, 
  generateId, 
  debounce, 
  isEmpty, 
  capitalize, 
  kebabCase, 
  camelCase 
} from '../utils'

describe('utils', () => {
  describe('cn', () => {
    it('merges class names correctly', () => {
      expect(cn('class1', 'class2')).toBe('class1 class2')
    })

    it('handles conditional classes', () => {
      expect(cn('base', { 'conditional': true, 'hidden': false })).toBe('base conditional')
    })
  })

  describe('formatDate', () => {
    it('formats date string correctly', () => {
      const date = '2024-01-15T10:30:00Z'
      const formatted = formatDate(date)
      expect(formatted).toMatch(/January 15, 2024/)
    })

    it('formats Date object correctly', () => {
      const date = new Date('2024-01-15T10:30:00Z')
      const formatted = formatDate(date)
      expect(formatted).toMatch(/January 15, 2024/)
    })
  })

  describe('formatRelativeTime', () => {
    it('returns "just now" for recent dates', () => {
      const now = new Date()
      const recent = new Date(now.getTime() - 30 * 1000) // 30 seconds ago
      expect(formatRelativeTime(recent)).toBe('just now')
    })

    it('returns minutes ago for recent dates', () => {
      const now = new Date()
      const recent = new Date(now.getTime() - 5 * 60 * 1000) // 5 minutes ago
      expect(formatRelativeTime(recent)).toBe('5 minutes ago')
    })

    it('returns hours ago for older dates', () => {
      const now = new Date()
      const recent = new Date(now.getTime() - 2 * 60 * 60 * 1000) // 2 hours ago
      expect(formatRelativeTime(recent)).toBe('2 hours ago')
    })
  })

  describe('truncateText', () => {
    it('truncates long text', () => {
      const longText = 'This is a very long text that should be truncated'
      expect(truncateText(longText, 20)).toBe('This is a very lo...')
    })

    it('returns original text if shorter than limit', () => {
      const shortText = 'Short text'
      expect(truncateText(shortText, 20)).toBe('Short text')
    })
  })

  describe('generateId', () => {
    it('generates a string ID', () => {
      const id = generateId()
      expect(typeof id).toBe('string')
      expect(id.length).toBe(9)
    })

    it('generates unique IDs', () => {
      const id1 = generateId()
      const id2 = generateId()
      expect(id1).not.toBe(id2)
    })
  })

  describe('debounce', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('delays function execution', () => {
      const mockFn = jest.fn()
      const debouncedFn = debounce(mockFn, 100)

      debouncedFn()
      expect(mockFn).not.toHaveBeenCalled()

      jest.advanceTimersByTime(100)
      expect(mockFn).toHaveBeenCalledTimes(1)
    })

    it('cancels previous calls', () => {
      const mockFn = jest.fn()
      const debouncedFn = debounce(mockFn, 100)

      debouncedFn()
      debouncedFn()
      debouncedFn()

      jest.advanceTimersByTime(100)
      expect(mockFn).toHaveBeenCalledTimes(1)
    })
  })

  describe('isEmpty', () => {
    it('returns true for null and undefined', () => {
      expect(isEmpty(null)).toBe(true)
      expect(isEmpty(undefined)).toBe(true)
    })

    it('returns true for empty string', () => {
      expect(isEmpty('')).toBe(true)
      expect(isEmpty('   ')).toBe(true)
    })

    it('returns true for empty array', () => {
      expect(isEmpty([])).toBe(true)
    })

    it('returns true for empty object', () => {
      expect(isEmpty({})).toBe(true)
    })

    it('returns false for non-empty values', () => {
      expect(isEmpty('hello')).toBe(false)
      expect(isEmpty([1, 2, 3])).toBe(false)
      expect(isEmpty({ key: 'value' })).toBe(false)
    })
  })

  describe('capitalize', () => {
    it('capitalizes first letter', () => {
      expect(capitalize('hello')).toBe('Hello')
      expect(capitalize('world')).toBe('World')
    })
  })

  describe('kebabCase', () => {
    it('converts to kebab-case', () => {
      expect(kebabCase('helloWorld')).toBe('hello-world')
      expect(kebabCase('Hello World')).toBe('hello-world')
      expect(kebabCase('hello_world')).toBe('hello-world')
    })
  })

  describe('camelCase', () => {
    it('converts to camelCase', () => {
      expect(camelCase('hello world')).toBe('helloWorld')
      expect(camelCase('hello-world')).toBe('helloWorld')
      expect(camelCase('hello_world')).toBe('helloWorld')
    })
  })
})

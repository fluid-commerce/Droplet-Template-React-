# Webhook Testing Suite

Complete testing tools for all 47 Fluid webhook endpoints.

## 🚀 Quick Start

```bash
# Test all webhooks (with rate limiting)
./test-webhooks-slow.sh

# Test key webhooks only  
./test-key-webhooks.sh

# Test all webhooks (fast - may hit rate limits)
./test-all-webhooks.sh
```

## 📁 Files

- `test-all-webhooks.sh` - Complete test suite (47 webhooks)
- `test-webhooks-slow.sh` - Rate-limited version for production
- `test-key-webhooks.sh` - Essential webhook subset
- `webhook-test-commands.md` - Manual curl command reference

## 🎯 Use Cases

- **Development**: Test webhook implementations
- **CI/CD**: Automated webhook validation  
- **Documentation**: Copy-paste API examples
- **Debugging**: Quick endpoint verification

## ⚡ Rate Limits

Fluid API has rate limits. Use `test-webhooks-slow.sh` for production testing.
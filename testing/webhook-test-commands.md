# Webhook Testing Commands

## Test Real Fluid API Endpoints

### 1. Order Completed (Creates Real Order)
```bash
curl -X POST "https://droplet-backend.onrender.com/api/droplet/test-webhook" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dit_mLBUkHPwy8ck791xVXGYYfF4ZS3KKVYw" \
  -d '{
    "webhookType": "order_completed",
    "installationId": "dri_cttu5cmjeqbmzm6wyhraw8ta08cvcxwd",
    "testData": {
      "customer_name": "API Test Customer",
      "total": 299.99
    }
  }'
```

### 2. Product Created (Creates Real Product)
```bash
curl -X POST "https://droplet-backend.onrender.com/api/droplet/test-webhook" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dit_mLBUkHPwy8ck791xVXGYYfF4ZS3KKVYw" \
  -d '{
    "webhookType": "product_created",
    "installationId": "dri_cttu5cmjeqbmzm6wyhraw8ta08cvcxwd",
    "testData": {
      "title": "API Test Product",
      "price": "49.99",
      "description": "Product created via webhook test"
    }
  }'
```

### 3. Contact Created (Creates Real Contact)
```bash
curl -X POST "https://droplet-backend.onrender.com/api/droplet/test-webhook" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dit_mLBUkHPwy8ck791xVXGYYfF4ZS3KKVYw" \
  -d '{
    "webhookType": "contact_created",
    "installationId": "dri_cttu5cmjeqbmzm6wyhraw8ta08cvcxwd",
    "testData": {
      "first_name": "Jane",
      "last_name": "Smith",
      "email": "jane.smith@apitest.com"
    }
  }'
```

### 4. Order Shipped (Updates Existing Order)
```bash
curl -X POST "https://droplet-backend.onrender.com/api/droplet/test-webhook" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dit_mLBUkHPwy8ck791xVXGYYfF4ZS3KKVYw" \
  -d '{
    "webhookType": "order_shipped",
    "installationId": "dri_cttu5cmjeqbmzm6wyhraw8ta08cvcxwd",
    "testData": {
      "tracking_number": "UPS123456789"
    }
  }'
```

### 5. Cart Abandoned (Simulated Event)
```bash
curl -X POST "https://droplet-backend.onrender.com/api/droplet/test-webhook" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dit_mLBUkHPwy8ck791xVXGYYfF4ZS3KKVYw" \
  -d '{
    "webhookType": "cart_abandoned",
    "installationId": "dri_cttu5cmjeqbmzm6wyhraw8ta08cvcxwd",
    "testData": {
      "cart_value": 189.99,
      "items_count": 2,
      "customer_email": "abandoned@test.com"
    }
  }'
```

## Verification Steps

After running each test:

1. **Check Response**: Look for `"success": true` in the JSON response
2. **Check Resource ID**: Verify a `resourceId` is returned for real resources
3. **Check Fluid Dashboard**: Log into your Fluid account to see if orders/products/contacts were actually created
4. **Check Webhook Logs**: Look in your droplet dashboard for webhook events
5. **Check Backend Logs**: Monitor the console for detailed logging

## Expected Results

### Real Resource Creation:
- `order_completed`: Creates actual order in Fluid
- `product_created`: Creates actual product in Fluid  
- `contact_created`: Creates actual contact in Fluid
- Order updates (`order_shipped`, etc.): Updates existing orders

### Simulated Events:
- `cart_abandoned`: Returns simulated data
- `popup_submitted`: Returns simulated data
- Event webhooks: Returns simulated data
- Subscription webhooks: Returns simulated data

## Error Testing

Test invalid scenarios:
```bash
# Invalid webhook type
curl -X POST "https://droplet-backend.onrender.com/api/droplet/test-webhook" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dit_mLBUkHPwy8ck791xVXGYYfF4ZS3KKVYw" \
  -d '{
    "webhookType": "invalid_webhook",
    "installationId": "dri_cttu5cmjeqbmzm6wyhraw8ta08cvcxwd"
  }'

# Missing authentication
curl -X POST "https://droplet-backend.onrender.com/api/droplet/test-webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "webhookType": "order_completed",
    "installationId": "dri_cttu5cmjeqbmzm6wyhraw8ta08cvcxwd"
  }'
```
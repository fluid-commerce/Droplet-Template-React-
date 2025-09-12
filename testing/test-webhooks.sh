#!/bin/bash

# Test script for Fluid webhook endpoints
# Run this after starting the backend server with: npm run dev

BASE_URL="http://localhost:3001"
INSTALLATION_ID="dri_cttu5cmjeqbmzm6wyhraw8ta08cvcxwd"  # Your test installation ID
API_KEY="dit_mLBUkHPwy8ck791xVXGYYfF4ZS3KKVYw"         # Your test API key

echo "🧪 Testing Fluid Webhook Endpoints"
echo "=================================="

# Test 1: Order Completed (should create real order)
echo "📦 Testing order_completed webhook..."
curl -X POST "$BASE_URL/api/droplet/test-webhook" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "webhookType": "order_completed",
    "installationId": "'$INSTALLATION_ID'",
    "testData": {
      "customer_name": "Test Customer",
      "total": 199.99
    }
  }' | jq '.'

echo -e "\n"

# Test 2: Product Created (should create real product)  
echo "🛍️ Testing product_created webhook..."
curl -X POST "$BASE_URL/api/droplet/test-webhook" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "webhookType": "product_created",
    "installationId": "'$INSTALLATION_ID'",
    "testData": {
      "title": "Test Product via API",
      "price": "29.99"
    }
  }' | jq '.'

echo -e "\n"

# Test 3: Contact Created (should create real contact)
echo "👥 Testing contact_created webhook..."
curl -X POST "$BASE_URL/api/droplet/test-webhook" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "webhookType": "contact_created", 
    "installationId": "'$INSTALLATION_ID'",
    "testData": {
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@test.com"
    }
  }' | jq '.'

echo -e "\n"

# Test 4: Cart Abandoned (simulated webhook)
echo "🛒 Testing cart_abandoned webhook (simulated)..."
curl -X POST "$BASE_URL/api/droplet/test-webhook" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "webhookType": "cart_abandoned",
    "installationId": "'$INSTALLATION_ID'",
    "testData": {
      "cart_value": 150.00,
      "items_count": 3
    }
  }' | jq '.'

echo -e "\n"

# Test 5: Invalid webhook type (should fail gracefully)
echo "❌ Testing invalid webhook type..."
curl -X POST "$BASE_URL/api/droplet/test-webhook" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "webhookType": "invalid_webhook_type",
    "installationId": "'$INSTALLATION_ID'",
    "testData": {}
  }' | jq '.'

echo -e "\n✅ Testing completed!"
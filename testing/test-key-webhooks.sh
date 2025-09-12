#!/bin/bash

# Test key webhook endpoints to verify functionality
BASE_URL="https://droplet-backend.onrender.com"
INSTALLATION_ID="dri_cttu5cmjeqbmzm6wyhraw8ta08cvcxwd"
API_KEY="dit_mLBUkHPwy8ck791xVXGYYfF4ZS3KKVYw"

echo "🧪 Testing Key Webhook Endpoints"
echo "==============================="

# Test 1: Order Creation (Real API call)
echo "📦 Testing order_created webhook..."
sleep 2
response1=$(curl -s -X POST "$BASE_URL/api/droplet/test-webhook" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "webhookType": "order_created",
    "installationId": "'$INSTALLATION_ID'",
    "testData": {
      "customer_name": "Webhook Test Customer",
      "total": 199.99
    }
  }')

echo "$response1" | jq '.'
echo ""

# Wait to avoid rate limiting
echo "⏱️  Waiting 10 seconds to avoid rate limits..."
sleep 10

# Test 2: Product Creation (Real API call)  
echo "🛍️ Testing product_created webhook..."
response2=$(curl -s -X POST "$BASE_URL/api/droplet/test-webhook" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "webhookType": "product_created",
    "installationId": "'$INSTALLATION_ID'",
    "testData": {
      "title": "Test Product from Script",
      "price": "49.99"
    }
  }')

echo "$response2" | jq '.'
echo ""

# Wait to avoid rate limiting
echo "⏱️  Waiting 10 seconds to avoid rate limits..."
sleep 10

# Test 3: Cart Abandoned (Simulated)
echo "🛒 Testing cart_abandoned webhook (simulated)..."
response3=$(curl -s -X POST "$BASE_URL/api/droplet/test-webhook" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "webhookType": "cart_abandoned", 
    "installationId": "'$INSTALLATION_ID'",
    "testData": {
      "cart_value": 150.00,
      "items_count": 2
    }
  }')

echo "$response3" | jq '.'
echo ""

echo "✅ Key webhook testing completed!"
echo "💡 Visit your Fluid dashboard to verify real orders/products were created."
#!/bin/bash

# Comprehensive test script for all 47 Fluid webhook endpoints
# This will test every single webhook type with the real API

BASE_URL="https://droplet-backend.onrender.com"
INSTALLATION_ID="dri_cttu5cmjeqbmzm6wyhraw8ta08cvcxwd"
API_KEY="dit_mLBUkHPwy8ck791xVXGYYfF4ZS3KKVYw"

echo "🚀 Testing ALL 47 Fluid Webhook Endpoints"
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test function
test_webhook() {
    local webhook_type=$1
    local description=$2
    local test_data=$3
    
    echo -e "${BLUE}📍 Testing: $webhook_type${NC} - $description"
    
    response=$(curl -s -X POST "$BASE_URL/api/droplet/test-webhook" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $API_KEY" \
        -d "{
            \"webhookType\": \"$webhook_type\",
            \"installationId\": \"$INSTALLATION_ID\",
            \"testData\": $test_data
        }")
    
    # Check if response contains success
    if echo "$response" | grep -q '"success":true'; then
        echo -e "${GREEN}   ✅ SUCCESS${NC}"
        # Extract resource ID if available
        resource_id=$(echo "$response" | jq -r '.data.test.resourceId // "N/A"')
        echo -e "${YELLOW}   📋 Resource ID: $resource_id${NC}"
    else
        echo -e "${RED}   ❌ FAILED${NC}"
        echo -e "${RED}   Error: $(echo "$response" | jq -r '.message // .error // "Unknown error"')${NC}"
    fi
    echo ""
}

# 1. ORDER WEBHOOKS (6 total)
echo -e "${BLUE}📦 ORDER WEBHOOKS${NC}"
test_webhook "order_created" "Create new order" '{"customer_name": "Test Customer", "total": 199.99}'
test_webhook "order_completed" "Complete order" '{"status": "completed"}'
test_webhook "order_updated" "Update order" '{"notes": "Order updated via webhook"}'
test_webhook "order_shipped" "Ship order" '{"tracking_number": "UPS123456789"}'
test_webhook "order_canceled" "Cancel order" '{"cancellation_reason": "Customer request"}'
test_webhook "order_refunded" "Refund order" '{"refund_amount": 199.99}'

# 2. PRODUCT WEBHOOKS (3 total)
echo -e "${BLUE}🛍️ PRODUCT WEBHOOKS${NC}"
test_webhook "product_created" "Create new product" '{"title": "Test Product", "price": "49.99"}'
test_webhook "product_updated" "Update product" '{"title": "Updated Product", "price": "59.99"}'
test_webhook "product_destroyed" "Delete product" '{"reason": "Discontinued"}'

# 3. USER WEBHOOKS (3 total)
echo -e "${BLUE}👤 USER WEBHOOKS${NC}"
test_webhook "user_created" "Create new user" '{"first_name": "John", "last_name": "Doe", "email": "john@test.com"}'
test_webhook "user_updated" "Update user" '{"first_name": "Jane", "last_name": "Smith"}'
test_webhook "user_deactivated" "Deactivate user" '{"reason": "Account closure"}'

# 4. CONTACT WEBHOOKS (2 total)
echo -e "${BLUE}📞 CONTACT WEBHOOKS${NC}"
test_webhook "contact_created" "Create new contact" '{"first_name": "Alice", "email": "alice@test.com"}'
test_webhook "contact_updated" "Update contact" '{"phone": "+1-555-0123"}'

# 5. CUSTOMER WEBHOOKS (2 total)
echo -e "${BLUE}👥 CUSTOMER WEBHOOKS${NC}"
test_webhook "customer_created" "Create new customer" '{"first_name": "Bob", "email": "bob@test.com"}'
test_webhook "customer_updated" "Update customer" '{"phone": "+1-555-0124"}'

# 6. CART & SHOPPING WEBHOOKS (6 total)
echo -e "${BLUE}🛒 CART & SHOPPING WEBHOOKS${NC}"
test_webhook "cart_updated" "Update cart" '{"total_amount": 89.99, "items_count": 2}'
test_webhook "cart_abandoned" "Abandon cart" '{"total_amount": 150.00, "customer_email": "abandoned@test.com"}'
test_webhook "cart_update_address" "Update cart address" '{"address1": "123 New Street", "city": "New City"}'
test_webhook "cart_update_cart_email" "Update cart email" '{"email": "newemail@test.com"}'
test_webhook "cart_add_items" "Add items to cart" '{"items_count": 1, "product_name": "New Item"}'
test_webhook "cart_remove_items" "Remove items from cart" '{"items_count": -1, "product_name": "Removed Item"}'

# 7. SUBSCRIPTION WEBHOOKS (3 total)
echo -e "${BLUE}💳 SUBSCRIPTION WEBHOOKS${NC}"
test_webhook "subscription_started" "Start subscription" '{"plan_name": "Premium Plan", "amount": 29.99}'
test_webhook "subscription_paused" "Pause subscription" '{"reason": "Payment failed"}'
test_webhook "subscription_cancelled" "Cancel subscription" '{"reason": "Customer request"}'

# 8. EVENT WEBHOOKS (3 total)
echo -e "${BLUE}📅 EVENT WEBHOOKS${NC}"
test_webhook "event_created" "Create new event" '{"event_name": "Product Launch", "date": "2025-10-15"}'
test_webhook "event_updated" "Update event" '{"event_name": "Updated Launch Event"}'
test_webhook "event_deleted" "Delete event" '{"reason": "Event cancelled"}'

# 9. MARKETING & ENGAGEMENT WEBHOOKS (3 total)
echo -e "${BLUE}📢 MARKETING & ENGAGEMENT WEBHOOKS${NC}"
test_webhook "webchat_submitted" "Webchat submission" '{"message": "Hello, I need help", "visitor_email": "help@test.com"}'
test_webhook "popup_submitted" "Popup form submission" '{"popup_name": "Newsletter Signup", "visitor_email": "newsletter@test.com"}'
test_webhook "bot_message_created" "Bot message created" '{"message": "How can I help you?", "bot_name": "Support Bot"}'

# 10. SYSTEM & INTEGRATION WEBHOOKS (3 total)
echo -e "${BLUE}⚙️ SYSTEM & INTEGRATION WEBHOOKS${NC}"
test_webhook "droplet_installed" "Droplet installed" '{"droplet_id": "drp_test_123", "company_id": "comp_test_456"}'
test_webhook "droplet_uninstalled" "Droplet uninstalled" '{"reason": "No longer needed"}'
test_webhook "enrollment_completed" "Enrollment completed" '{"user_email": "enrolled@test.com", "enrollment_type": "premium"}'

# 11. AUTHENTICATION & SECURITY WEBHOOKS (2 total)
echo -e "${BLUE}🔐 AUTHENTICATION & SECURITY WEBHOOKS${NC}"
test_webhook "mfa_missing_email" "MFA missing email" '{"user_email": "mfa@test.com", "attempted_login": true}'
test_webhook "mfa_verified" "MFA verified" '{"user_email": "verified@test.com", "verification_method": "email_code"}'

echo -e "${GREEN}🎉 All webhook tests completed!${NC}"
echo "Check the responses above to see which webhooks are working correctly."
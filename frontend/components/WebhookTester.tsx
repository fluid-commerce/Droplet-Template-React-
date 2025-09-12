import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { apiClient } from '@/lib/api'

interface WebhookEvent {
  id: string
  type: string
  data: any
  createdAt: string
  processingStatus?: string
  retryCount?: number
}

interface WebhookTestResult {
  type: string
  success: boolean
  resourceId?: string
  resourceData?: any
  error?: string
  details?: any
  createdAt: string
}

interface WebhookTesterProps {
  installationId: string | null
  fluidApiKey: string | null
  brandGuidelines?: any
}

export function WebhookTester({ installationId, fluidApiKey, brandGuidelines }: WebhookTesterProps) {
  const [loadingStates, setLoadingStates] = useState<{ [key: string]: boolean }>({})
  const [testResults, setTestResults] = useState<{ [key: string]: WebhookTestResult }>({})
  const [recentWebhooks, setRecentWebhooks] = useState<WebhookEvent[]>([])
  const [expandedLogs, setExpandedLogs] = useState<{ [key: string]: boolean }>({})
  const [showJsonData, setShowJsonData] = useState<{ [key: string]: boolean }>({})
  const [expandedCategories, setExpandedCategories] = useState<{ [key: string]: boolean }>({})
  
  // Modal state for Swagger-style dynamic forms
  const [showModal, setShowModal] = useState(false)
  const [currentWebhookType, setCurrentWebhookType] = useState('')
  const [formData, setFormData] = useState<{ [key: string]: any }>({})
  const [availableResources, setAvailableResources] = useState<any[]>([])

  const formatColor = (color: string | null | undefined) => {
    if (!color) return undefined
    return color.startsWith('#') ? color : `#${color}`
  }

  // Check if webhook needs modal (UPDATE/DELETE operations)
  const needsModal = (webhookType: string) => {
    return webhookType.includes('updated') || 
           webhookType.includes('refunded') || 
           webhookType.includes('canceled') ||
           webhookType.includes('shipped') ||
           webhookType.includes('completed') ||
           webhookType.includes('destroyed')
  }

  // Get comprehensive form fields for each webhook type (like curl commands)
  const getFormFields = (webhookType: string) => {
    switch (webhookType) {
      case 'order_created':
        return [
          { name: 'customer_name', label: 'Customer Name', type: 'text', placeholder: 'John Doe' },
          { name: 'email', label: 'Customer Email', type: 'email', placeholder: 'john@example.com' },
          { name: 'phone', label: 'Phone', type: 'tel', placeholder: '+1-555-0123' },
          { name: 'total', label: 'Order Total', type: 'number', placeholder: '199.99' },
          { name: 'currency', label: 'Currency', type: 'text', placeholder: 'USD' },
          { name: 'address1', label: 'Shipping Address', type: 'text', placeholder: '123 Main St' },
          { name: 'city', label: 'City', type: 'text', placeholder: 'New York' },
          { name: 'state', label: 'State', type: 'text', placeholder: 'NY' },
          { name: 'postal_code', label: 'ZIP Code', type: 'text', placeholder: '10001' },
          { name: 'notes', label: 'Order Notes', type: 'textarea', placeholder: 'Special instructions...' }
        ]
      case 'order_refunded':
        return [
          { name: 'order_id', label: 'Order ID', type: 'text', placeholder: '44064226' },
          { name: 'refund_amount', label: 'Refund Amount', type: 'number', placeholder: '199.99' },
          { name: 'refund_reason', label: 'Refund Reason', type: 'text', placeholder: 'Customer request' },
          { name: 'refund_type', label: 'Refund Type', type: 'select', options: ['full', 'partial', 'store_credit'] },
          { name: 'refund_method', label: 'Refund Method', type: 'select', options: ['original_payment', 'store_credit', 'check'] },
          { name: 'partial_refund', label: 'Partial Refund', type: 'checkbox' },
          { name: 'refund_shipping', label: 'Refund Shipping', type: 'checkbox' },
          { name: 'refund_tax', label: 'Refund Tax', type: 'checkbox' },
          { name: 'internal_notes', label: 'Internal Notes', type: 'textarea', placeholder: 'Internal processing notes...' }
        ]
      case 'order_shipped':
        return [
          { name: 'order_id', label: 'Order ID', type: 'text', placeholder: '44064226' },
          { name: 'tracking_number', label: 'Tracking Number', type: 'text', placeholder: 'UPS123456789' },
          { name: 'carrier', label: 'Shipping Carrier', type: 'select', options: ['UPS', 'FedEx', 'USPS', 'DHL', 'Other'] },
          { name: 'shipping_method', label: 'Shipping Method', type: 'text', placeholder: 'Ground' },
          { name: 'estimated_delivery', label: 'Estimated Delivery', type: 'date' },
          { name: 'shipped_at', label: 'Shipped Date/Time', type: 'datetime-local' },
          { name: 'shipping_cost', label: 'Shipping Cost', type: 'number', placeholder: '12.99' },
          { name: 'package_weight', label: 'Package Weight (lbs)', type: 'number', placeholder: '2.5' },
          { name: 'shipping_notes', label: 'Shipping Notes', type: 'textarea', placeholder: 'Package handling notes...' }
        ]
      case 'order_canceled':
        return [
          { name: 'order_id', label: 'Order ID', type: 'text', placeholder: '44064226' },
          { name: 'cancellation_reason', label: 'Cancellation Reason', type: 'select', options: ['customer_request', 'out_of_stock', 'payment_failed', 'fraudulent', 'other'] },
          { name: 'cancel_reason_details', label: 'Reason Details', type: 'textarea', placeholder: 'Additional details...' },
          { name: 'refund_issued', label: 'Refund Issued', type: 'checkbox' },
          { name: 'cancel_date', label: 'Cancellation Date', type: 'datetime-local' },
          { name: 'notified_customer', label: 'Customer Notified', type: 'checkbox' }
        ]
      case 'order_updated':
        return [
          { name: 'order_id', label: 'Order ID', type: 'text', placeholder: '44064226' },
          { name: 'status', label: 'Order Status', type: 'select', options: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'] },
          { name: 'tracking_number', label: 'Tracking Number', type: 'text', placeholder: 'UPS123456789' },
          { name: 'carrier', label: 'Shipping Carrier', type: 'select', options: ['UPS', 'FedEx', 'USPS', 'DHL', 'Other'] },
          { name: 'shipping_method', label: 'Shipping Method', type: 'text', placeholder: 'Ground' },
          { name: 'estimated_delivery', label: 'Estimated Delivery', type: 'date' },
          { name: 'shipped_at', label: 'Shipped Date/Time', type: 'datetime-local' },
          { name: 'shipping_cost', label: 'Shipping Cost', type: 'number', placeholder: '12.99' },
          { name: 'package_weight', label: 'Package Weight (lbs)', type: 'number', placeholder: '2.5' },
          { name: 'update_notes', label: 'Update Notes', type: 'textarea', placeholder: 'Details about the order update...' }
        ]
      case 'order_completed':
        return [
          { name: 'order_id', label: 'Order ID', type: 'text', placeholder: '44064226' },
          { name: 'completion_date', label: 'Completion Date', type: 'datetime-local' },
          { name: 'final_total', label: 'Final Total', type: 'number', placeholder: '199.99' },
          { name: 'payment_status', label: 'Payment Status', type: 'select', options: ['paid', 'pending', 'failed', 'refunded'] },
          { name: 'completion_notes', label: 'Completion Notes', type: 'textarea', placeholder: 'Order completion details...' }
        ]
      case 'customer_created':
        return [
          { name: 'first_name', label: 'First Name', type: 'text', placeholder: 'John' },
          { name: 'last_name', label: 'Last Name', type: 'text', placeholder: 'Doe' },
          { name: 'email', label: 'Email', type: 'email', placeholder: 'john@example.com' },
          { name: 'phone', label: 'Phone', type: 'tel', placeholder: '+1-555-0123' },
          { name: 'company', label: 'Company', type: 'text', placeholder: 'Acme Corp' },
          { name: 'title', label: 'Job Title', type: 'text', placeholder: 'Manager' },
          { name: 'address1', label: 'Address Line 1', type: 'text', placeholder: '123 Main St' },
          { name: 'city', label: 'City', type: 'text', placeholder: 'New York' },
          { name: 'state', label: 'State/Province', type: 'text', placeholder: 'NY' },
          { name: 'postal_code', label: 'ZIP/Postal Code', type: 'text', placeholder: '10001' },
          { name: 'country', label: 'Country', type: 'text', placeholder: 'United States' },
          { name: 'status', label: 'Customer Status', type: 'select', options: ['active', 'inactive', 'pending'] },
          { name: 'tags', label: 'Customer Tags', type: 'text', placeholder: 'VIP, Premium, Loyalty' }
        ]
      case 'customer_updated':
      case 'contact_updated':
      case 'user_updated':
        return [
          { name: 'customer_id', label: 'Customer ID', type: 'text', placeholder: '11854186' },
          { name: 'first_name', label: 'First Name', type: 'text', placeholder: 'John' },
          { name: 'last_name', label: 'Last Name', type: 'text', placeholder: 'Doe' },
          { name: 'email', label: 'Email', type: 'email', placeholder: 'john@example.com' },
          { name: 'phone', label: 'Phone', type: 'tel', placeholder: '+1-555-0123' },
          { name: 'company', label: 'Company', type: 'text', placeholder: 'Acme Corp' },
          { name: 'title', label: 'Job Title', type: 'text', placeholder: 'Manager' },
          { name: 'address1', label: 'Address Line 1', type: 'text', placeholder: '123 Main St' },
          { name: 'address2', label: 'Address Line 2', type: 'text', placeholder: 'Apt 4B' },
          { name: 'city', label: 'City', type: 'text', placeholder: 'New York' },
          { name: 'state', label: 'State/Province', type: 'text', placeholder: 'NY' },
          { name: 'postal_code', label: 'ZIP/Postal Code', type: 'text', placeholder: '10001' },
          { name: 'country', label: 'Country', type: 'text', placeholder: 'United States' },
          { name: 'status', label: 'Customer Status', type: 'select', options: ['active', 'inactive', 'pending', 'suspended'] },
          { name: 'tags', label: 'Customer Tags', type: 'text', placeholder: 'VIP, Premium, Loyalty' },
          { name: 'notes', label: 'Customer Notes', type: 'textarea', placeholder: 'Customer service notes...' }
        ]
      case 'contact_created':
        return [
          { name: 'first_name', label: 'First Name', type: 'text', placeholder: 'Jane' },
          { name: 'last_name', label: 'Last Name', type: 'text', placeholder: 'Smith' },
          { name: 'email', label: 'Email', type: 'email', placeholder: 'jane@example.com' },
          { name: 'phone', label: 'Phone', type: 'tel', placeholder: '+1-555-0124' },
          { name: 'company', label: 'Company', type: 'text', placeholder: 'Tech Corp' },
          { name: 'title', label: 'Job Title', type: 'text', placeholder: 'Developer' },
          { name: 'contact_type', label: 'Contact Type', type: 'select', options: ['lead', 'customer', 'prospect', 'partner'] },
          { name: 'source', label: 'Contact Source', type: 'text', placeholder: 'Website, Referral, Trade Show' }
        ]
      case 'product_created':
        return [
          { name: 'title', label: 'Product Title', type: 'text', placeholder: 'Amazing Product' },
          { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Product description...' },
          { name: 'price', label: 'Price', type: 'number', placeholder: '29.99' },
          { name: 'sku', label: 'SKU', type: 'text', placeholder: 'PROD-001' },
          { name: 'category', label: 'Category', type: 'text', placeholder: 'Electronics' },
          { name: 'brand', label: 'Brand', type: 'text', placeholder: 'BrandName' },
          { name: 'weight', label: 'Weight (lbs)', type: 'number', placeholder: '2.5' },
          { name: 'dimensions', label: 'Dimensions (LxWxH)', type: 'text', placeholder: '10x8x6 inches' },
          { name: 'image_url', label: 'Image URL', type: 'url', placeholder: 'https://example.com/image.jpg' },
          { name: 'in_stock', label: 'In Stock', type: 'checkbox' },
          { name: 'inventory_quantity', label: 'Inventory Quantity', type: 'number', placeholder: '100' },
          { name: 'active', label: 'Active Product', type: 'checkbox' }
        ]
      case 'product_updated':
        return [
          { name: 'product_id', label: 'Product ID', type: 'text', placeholder: '50438' },
          { name: 'title', label: 'Product Title', type: 'text', placeholder: 'Updated Product Name' },
          { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Updated product description...' },
          { name: 'price', label: 'Price', type: 'number', placeholder: '39.99' },
          { name: 'sale_price', label: 'Sale Price', type: 'number', placeholder: '29.99' },
          { name: 'sku', label: 'SKU', type: 'text', placeholder: 'PROD-001-V2' },
          { name: 'category', label: 'Category', type: 'text', placeholder: 'Electronics' },
          { name: 'brand', label: 'Brand', type: 'text', placeholder: 'BrandName' },
          { name: 'weight', label: 'Weight (lbs)', type: 'number', placeholder: '2.5' },
          { name: 'inventory_quantity', label: 'Inventory Quantity', type: 'number', placeholder: '75' },
          { name: 'active', label: 'Active Product', type: 'checkbox' },
          { name: 'featured', label: 'Featured Product', type: 'checkbox' },
          { name: 'tags', label: 'Product Tags', type: 'text', placeholder: 'new, sale, trending' }
        ]
      case 'product_destroyed':
        return [
          { name: 'product_id', label: 'Product ID', type: 'text', placeholder: '50438' },
          { name: 'title', label: 'Product Title', type: 'text', placeholder: 'Deleted Product Name' },
          { name: 'deletion_reason', label: 'Deletion Reason', type: 'select', options: ['discontinued', 'out_of_stock', 'quality_issue', 'customer_request', 'other'] },
          { name: 'deletion_date', label: 'Deletion Date', type: 'datetime-local' },
          { name: 'replacement_product_id', label: 'Replacement Product ID', type: 'text', placeholder: '50439' },
          { name: 'deletion_notes', label: 'Deletion Notes', type: 'textarea', placeholder: 'Reason for product deletion...' }
        ]
      case 'user_created':
        return [
          { name: 'first_name', label: 'First Name', type: 'text', placeholder: 'John' },
          { name: 'last_name', label: 'Last Name', type: 'text', placeholder: 'Doe' },
          { name: 'email', label: 'Email', type: 'email', placeholder: 'john@example.com' },
          { name: 'username', label: 'Username', type: 'text', placeholder: 'johndoe' },
          { name: 'role', label: 'User Role', type: 'select', options: ['admin', 'user', 'manager', 'viewer'] },
          { name: 'department', label: 'Department', type: 'text', placeholder: 'Sales' },
          { name: 'phone', label: 'Phone', type: 'tel', placeholder: '+1-555-0123' },
          { name: 'active', label: 'Active User', type: 'checkbox' }
        ]
      case 'user_deactivated':
        return [
          { name: 'user_id', label: 'User ID', type: 'text', placeholder: 'user_123' },
          { name: 'email', label: 'User Email', type: 'email', placeholder: 'john@example.com' },
          { name: 'deactivation_reason', label: 'Deactivation Reason', type: 'select', options: ['voluntary', 'policy_violation', 'inactive', 'security', 'other'] },
          { name: 'deactivation_date', label: 'Deactivation Date', type: 'datetime-local' },
          { name: 'deactivation_notes', label: 'Deactivation Notes', type: 'textarea', placeholder: 'Reason for user deactivation...' }
        ]
      case 'cart_updated':
        return [
          { name: 'cart_id', label: 'Cart ID', type: 'text', placeholder: 'cart_123456' },
          { name: 'customer_email', label: 'Customer Email', type: 'email', placeholder: 'customer@example.com' },
          { name: 'total_amount', label: 'Cart Total', type: 'number', placeholder: '159.99' },
          { name: 'items_count', label: 'Items Count', type: 'number', placeholder: '3' },
          { name: 'currency', label: 'Currency', type: 'text', placeholder: 'USD' },
          { name: 'discount_code', label: 'Discount Code', type: 'text', placeholder: 'SAVE10' },
          { name: 'discount_amount', label: 'Discount Amount', type: 'number', placeholder: '15.99' }
        ]
      case 'cart_abandoned':
        return [
          { name: 'cart_id', label: 'Cart ID', type: 'text', placeholder: 'cart_123456' },
          { name: 'customer_email', label: 'Customer Email', type: 'email', placeholder: 'customer@example.com' },
          { name: 'customer_name', label: 'Customer Name', type: 'text', placeholder: 'John Doe' },
          { name: 'total_amount', label: 'Cart Total', type: 'number', placeholder: '199.99' },
          { name: 'items_count', label: 'Items Count', type: 'number', placeholder: '4' },
          { name: 'abandoned_at', label: 'Abandoned Time', type: 'datetime-local' },
          { name: 'recovery_email_sent', label: 'Recovery Email Sent', type: 'checkbox' }
        ]
      case 'cart_update_address':
        return [
          { name: 'cart_id', label: 'Cart ID', type: 'text', placeholder: 'cart_123456' },
          { name: 'address1', label: 'Address Line 1', type: 'text', placeholder: '123 Main St' },
          { name: 'address2', label: 'Address Line 2', type: 'text', placeholder: 'Apt 4B' },
          { name: 'city', label: 'City', type: 'text', placeholder: 'New York' },
          { name: 'state', label: 'State/Province', type: 'text', placeholder: 'NY' },
          { name: 'postal_code', label: 'ZIP/Postal Code', type: 'text', placeholder: '10001' },
          { name: 'country', label: 'Country', type: 'text', placeholder: 'United States' }
        ]
      case 'cart_update_cart_email':
        return [
          { name: 'cart_id', label: 'Cart ID', type: 'text', placeholder: 'cart_123456' },
          { name: 'old_email', label: 'Previous Email', type: 'email', placeholder: 'old@example.com' },
          { name: 'new_email', label: 'New Email', type: 'email', placeholder: 'new@example.com' },
          { name: 'update_reason', label: 'Update Reason', type: 'select', options: ['customer_request', 'typo_correction', 'email_verification'] }
        ]
      case 'cart_add_items':
        return [
          { name: 'cart_id', label: 'Cart ID', type: 'text', placeholder: 'cart_123456' },
          { name: 'product_id', label: 'Product ID', type: 'text', placeholder: '50438' },
          { name: 'product_name', label: 'Product Name', type: 'text', placeholder: 'Amazing Product' },
          { name: 'quantity', label: 'Quantity', type: 'number', placeholder: '2' },
          { name: 'unit_price', label: 'Unit Price', type: 'number', placeholder: '29.99' },
          { name: 'total_price', label: 'Total Price', type: 'number', placeholder: '59.98' }
        ]
      case 'cart_remove_items':
        return [
          { name: 'cart_id', label: 'Cart ID', type: 'text', placeholder: 'cart_123456' },
          { name: 'product_id', label: 'Product ID', type: 'text', placeholder: '50438' },
          { name: 'product_name', label: 'Product Name', type: 'text', placeholder: 'Amazing Product' },
          { name: 'quantity_removed', label: 'Quantity Removed', type: 'number', placeholder: '1' },
          { name: 'removal_reason', label: 'Removal Reason', type: 'select', options: ['customer_request', 'out_of_stock', 'price_change'] }
        ]
      case 'subscription_started':
        return [
          { name: 'subscription_id', label: 'Subscription ID', type: 'text', placeholder: 'sub_123456' },
          { name: 'customer_email', label: 'Customer Email', type: 'email', placeholder: 'customer@example.com' },
          { name: 'plan_name', label: 'Plan Name', type: 'text', placeholder: 'Premium Plan' },
          { name: 'billing_cycle', label: 'Billing Cycle', type: 'select', options: ['monthly', 'quarterly', 'yearly'] },
          { name: 'start_date', label: 'Start Date', type: 'date' },
          { name: 'next_billing_date', label: 'Next Billing Date', type: 'date' },
          { name: 'amount', label: 'Subscription Amount', type: 'number', placeholder: '29.99' }
        ]
      case 'subscription_paused':
        return [
          { name: 'subscription_id', label: 'Subscription ID', type: 'text', placeholder: 'sub_123456' },
          { name: 'customer_email', label: 'Customer Email', type: 'email', placeholder: 'customer@example.com' },
          { name: 'pause_reason', label: 'Pause Reason', type: 'select', options: ['customer_request', 'payment_failed', 'temporary_hold'] },
          { name: 'pause_date', label: 'Pause Date', type: 'date' },
          { name: 'resume_date', label: 'Resume Date', type: 'date' },
          { name: 'pause_notes', label: 'Pause Notes', type: 'textarea', placeholder: 'Reason for subscription pause...' }
        ]
      case 'subscription_cancelled':
        return [
          { name: 'subscription_id', label: 'Subscription ID', type: 'text', placeholder: 'sub_123456' },
          { name: 'customer_email', label: 'Customer Email', type: 'email', placeholder: 'customer@example.com' },
          { name: 'cancellation_reason', label: 'Cancellation Reason', type: 'select', options: ['customer_request', 'payment_failed', 'policy_violation', 'other'] },
          { name: 'cancellation_date', label: 'Cancellation Date', type: 'date' },
          { name: 'refund_issued', label: 'Refund Issued', type: 'checkbox' },
          { name: 'cancellation_notes', label: 'Cancellation Notes', type: 'textarea', placeholder: 'Reason for subscription cancellation...' }
        ]
      case 'event_created':
        return [
          { name: 'event_name', label: 'Event Name', type: 'text', placeholder: 'Product Launch' },
          { name: 'event_description', label: 'Event Description', type: 'textarea', placeholder: 'Description of the event...' },
          { name: 'event_date', label: 'Event Date', type: 'datetime-local' },
          { name: 'event_location', label: 'Event Location', type: 'text', placeholder: 'Convention Center' },
          { name: 'event_type', label: 'Event Type', type: 'select', options: ['webinar', 'conference', 'workshop', 'meeting', 'other'] },
          { name: 'max_attendees', label: 'Max Attendees', type: 'number', placeholder: '100' }
        ]
      case 'event_updated':
        return [
          { name: 'event_id', label: 'Event ID', type: 'text', placeholder: 'event_123' },
          { name: 'event_name', label: 'Event Name', type: 'text', placeholder: 'Updated Event Name' },
          { name: 'event_description', label: 'Event Description', type: 'textarea', placeholder: 'Updated event description...' },
          { name: 'event_date', label: 'Event Date', type: 'datetime-local' },
          { name: 'event_location', label: 'Event Location', type: 'text', placeholder: 'New Convention Center' },
          { name: 'update_reason', label: 'Update Reason', type: 'select', options: ['date_change', 'location_change', 'content_update', 'other'] }
        ]
      case 'event_deleted':
        return [
          { name: 'event_id', label: 'Event ID', type: 'text', placeholder: 'event_123' },
          { name: 'event_name', label: 'Event Name', type: 'text', placeholder: 'Cancelled Event' },
          { name: 'deletion_reason', label: 'Deletion Reason', type: 'select', options: ['cancelled', 'postponed', 'venue_issue', 'low_attendance', 'other'] },
          { name: 'deletion_date', label: 'Deletion Date', type: 'datetime-local' },
          { name: 'attendees_notified', label: 'Attendees Notified', type: 'checkbox' }
        ]
      case 'webchat_submitted':
        return [
          { name: 'chat_id', label: 'Chat ID', type: 'text', placeholder: 'chat_123456' },
          { name: 'customer_name', label: 'Customer Name', type: 'text', placeholder: 'John Doe' },
          { name: 'customer_email', label: 'Customer Email', type: 'email', placeholder: 'john@example.com' },
          { name: 'message', label: 'Message', type: 'textarea', placeholder: 'Customer inquiry message...' },
          { name: 'subject', label: 'Subject', type: 'text', placeholder: 'Product Question' },
          { name: 'priority', label: 'Priority', type: 'select', options: ['low', 'medium', 'high', 'urgent'] }
        ]
      case 'popup_submitted':
        return [
          { name: 'popup_id', label: 'Popup ID', type: 'text', placeholder: 'popup_123' },
          { name: 'customer_name', label: 'Customer Name', type: 'text', placeholder: 'Jane Smith' },
          { name: 'customer_email', label: 'Customer Email', type: 'email', placeholder: 'jane@example.com' },
          { name: 'popup_type', label: 'Popup Type', type: 'select', options: ['newsletter', 'promotion', 'survey', 'lead_capture'] },
          { name: 'offer_code', label: 'Offer Code', type: 'text', placeholder: 'SAVE20' },
          { name: 'source_page', label: 'Source Page', type: 'text', placeholder: '/products' }
        ]
      case 'bot_message_created':
        return [
          { name: 'message_id', label: 'Message ID', type: 'text', placeholder: 'msg_123456' },
          { name: 'bot_name', label: 'Bot Name', type: 'text', placeholder: 'Support Bot' },
          { name: 'message_type', label: 'Message Type', type: 'select', options: ['welcome', 'support', 'promotional', 'follow_up'] },
          { name: 'message_content', label: 'Message Content', type: 'textarea', placeholder: 'Automated bot message content...' },
          { name: 'trigger_event', label: 'Trigger Event', type: 'text', placeholder: 'page_visit, time_delay, user_action' }
        ]
      case 'droplet_installed':
        return [
          { name: 'droplet_id', label: 'Droplet ID', type: 'text', placeholder: 'drp_123456' },
          { name: 'droplet_name', label: 'Droplet Name', type: 'text', placeholder: 'My Integration' },
          { name: 'installation_date', label: 'Installation Date', type: 'datetime-local' },
          { name: 'version', label: 'Droplet Version', type: 'text', placeholder: '1.0.0' },
          { name: 'configuration', label: 'Configuration', type: 'textarea', placeholder: 'Droplet configuration details...' }
        ]
      case 'droplet_uninstalled':
        return [
          { name: 'droplet_id', label: 'Droplet ID', type: 'text', placeholder: 'drp_123456' },
          { name: 'droplet_name', label: 'Droplet Name', type: 'text', placeholder: 'My Integration' },
          { name: 'uninstallation_date', label: 'Uninstallation Date', type: 'datetime-local' },
          { name: 'uninstall_reason', label: 'Uninstall Reason', type: 'select', options: ['user_request', 'payment_failed', 'policy_violation', 'other'] },
          { name: 'data_retention', label: 'Data Retention Period', type: 'text', placeholder: '30 days' }
        ]
      case 'enrollment_completed':
        return [
          { name: 'enrollment_id', label: 'Enrollment ID', type: 'text', placeholder: 'enroll_123' },
          { name: 'user_email', label: 'User Email', type: 'email', placeholder: 'user@example.com' },
          { name: 'enrollment_type', label: 'Enrollment Type', type: 'select', options: ['course', 'program', 'certification', 'training'] },
          { name: 'completion_date', label: 'Completion Date', type: 'datetime-local' },
          { name: 'score', label: 'Score/Grade', type: 'text', placeholder: '95%' },
          { name: 'certificate_issued', label: 'Certificate Issued', type: 'checkbox' }
        ]
      case 'mfa_missing_email':
        return [
          { name: 'user_id', label: 'User ID', type: 'text', placeholder: 'user_123' },
          { name: 'user_email', label: 'User Email', type: 'email', placeholder: 'user@example.com' },
          { name: 'mfa_type', label: 'MFA Type', type: 'select', options: ['sms', 'email', 'authenticator', 'backup_codes'] },
          { name: 'attempt_count', label: 'Attempt Count', type: 'number', placeholder: '3' },
          { name: 'last_attempt', label: 'Last Attempt', type: 'datetime-local' }
        ]
      case 'mfa_verified':
        return [
          { name: 'user_id', label: 'User ID', type: 'text', placeholder: 'user_123' },
          { name: 'user_email', label: 'User Email', type: 'email', placeholder: 'user@example.com' },
          { name: 'mfa_type', label: 'MFA Type', type: 'select', options: ['sms', 'email', 'authenticator', 'backup_codes'] },
          { name: 'verification_date', label: 'Verification Date', type: 'datetime-local' },
          { name: 'device_info', label: 'Device Info', type: 'text', placeholder: 'iPhone 14, Chrome Browser' }
        ]
      default:
        return []
    }
  }

  // Fetch available resources for selection
  const fetchResources = async (webhookType: string) => {
    if (!installationId || !fluidApiKey) return
    
    try {
      let endpoint = ''
      if (webhookType.includes('order')) endpoint = '/api/droplet/orders?limit=10'
      else if (webhookType.includes('product')) endpoint = '/api/droplet/products?limit=10'  
      else if (webhookType.includes('customer') || webhookType.includes('contact')) endpoint = '/api/droplet/contacts?limit=10'
      
      if (endpoint) {
        const response = await apiClient.get(`${endpoint}&installationId=${installationId}`, {
          headers: { 'Authorization': `Bearer ${fluidApiKey}` }
        })
        setAvailableResources(response.data.data.orders || response.data.data.products || response.data.data.contacts || [])
      }
    } catch (error) {
      console.error('Failed to fetch resources:', error)
      setAvailableResources([])
    }
  }

  // Open modal for webhook testing
  const openModal = async (webhookType: string) => {
    setCurrentWebhookType(webhookType)
    setFormData({})
    setShowModal(true)
    await fetchResources(webhookType)
  }

  // Handle form submission
  const handleModalSubmit = async () => {
    await executeWebhookTest(currentWebhookType, formData)
    setShowModal(false)
    setFormData({})
  }

  // Execute the webhook test with form data
  const executeWebhookTest = async (webhookType: string, testData: any = {}) => {
    if (!installationId || !fluidApiKey) {
      alert('Missing installation ID or API key')
      return
    }

    setLoadingStates(prev => ({ ...prev, [webhookType]: true }))
    try {
      const response = await apiClient.post('/api/droplet/test-webhook', {
        webhookType,
        installationId,
        testData: {
          customer_name: 'Jane Doe from Dashboard',
          total: 179.90,
          currency: 'USD',
          ...testData
        }
      }, {
        headers: {
          'Authorization': `Bearer ${fluidApiKey}`
        }
      })

      setTestResults(prev => ({ ...prev, [webhookType]: response.data.data.test }))
      setRecentWebhooks(response.data.data.recentWebhooks || [])
    } catch (err: any) {
      console.error('Webhook test failed:', err)
      
      // Handle specific case where customer API key is required
      if (err.response?.data?.requiresApiKey) {
        setTestResults(prev => ({ ...prev, [webhookType]: {
          type: webhookType,
          success: false,
          error: 'Customer API key required',
          details: {
            message: err.response.data.message,
            requiresApiKey: true,
            instructions: 'Please configure your Fluid API key in the Settings section above to test webhooks.'
          },
          createdAt: new Date().toISOString()
        }}))
      } else {
        setTestResults(prev => ({ ...prev, [webhookType]: {
          type: webhookType,
          success: false,
          error: err.response?.data?.message || 'Test failed',
          details: err.response?.data,
          createdAt: new Date().toISOString()
        }}))
      }
    } finally {
      setLoadingStates(prev => ({ ...prev, [webhookType]: false }))
    }
  }

  const handleTestWebhook = async (webhookType: string = 'order.created') => {
    // If needs modal, open it instead of direct test
    if (needsModal(webhookType)) {
      await openModal(webhookType)
      return
    }

    // Direct test for simple operations
    await executeWebhookTest(webhookType)
  }

  const toggleLogExpansion = (logId: string) => {
    setExpandedLogs(prev => ({
      ...prev,
      [logId]: !prev[logId]
    }))
  }

  const toggleCategoryExpansion = (categoryName: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }))
  }

  const toggleJsonData = (logId: string) => {
    setShowJsonData(prev => ({
      ...prev,
      [logId]: !prev[logId]
    }))
  }

  const formatJsonData = (data: any) => {
    try {
      return JSON.stringify(data, null, 2)
    } catch {
      return String(data)
    }
  }

  // Complete Fluid webhook events - ALL 47 webhook types
  const webhookEndpoints = [
    {
      category: 'Orders',
      endpoints: [
        { name: 'Order Created', type: 'order_created', method: 'POST', description: 'New order created' },
        { name: 'Order Completed', type: 'order_completed', method: 'POST', description: 'Order completion webhook' },
        { name: 'Order Updated', type: 'order_updated', method: 'PUT', description: 'Order status/details updated' },
        { name: 'Order Shipped', type: 'order_shipped', method: 'PUT', description: 'Order marked as shipped' },
        { name: 'Order Canceled', type: 'order_canceled', method: 'PUT', description: 'Order cancellation' },
        { name: 'Order Refunded', type: 'order_refunded', method: 'POST', description: 'Order refund processed' },
      ]
    },
    {
      category: 'Products',
      endpoints: [
        { name: 'Product Created', type: 'product_created', method: 'POST', description: 'New product created' },
        { name: 'Product Updated', type: 'product_updated', method: 'PUT', description: 'Product information updated' },
        { name: 'Product Destroyed', type: 'product_destroyed', method: 'DELETE', description: 'Product deleted/destroyed' },
      ]
    },
    {
      category: 'Users',
      endpoints: [
        { name: 'User Created', type: 'user_created', method: 'POST', description: 'New user account created' },
        { name: 'User Updated', type: 'user_updated', method: 'PUT', description: 'User profile updated' },
        { name: 'User Deactivated', type: 'user_deactivated', method: 'DELETE', description: 'User account deactivated' },
      ]
    },
    {
      category: 'Contacts',
      endpoints: [
        { name: 'Contact Created', type: 'contact_created', method: 'POST', description: 'New contact created' },
        { name: 'Contact Updated', type: 'contact_updated', method: 'PUT', description: 'Contact profile updated' },
      ]
    },
    {
      category: 'Customers',
      endpoints: [
        { name: 'Customer Created', type: 'customer_created', method: 'POST', description: 'New customer created' },
        { name: 'Customer Updated', type: 'customer_updated', method: 'PUT', description: 'Customer profile updated' },
      ]
    },
    {
      category: 'Cart & Shopping',
      endpoints: [
        { name: 'Cart Updated', type: 'cart_updated', method: 'PUT', description: 'Shopping cart contents updated' },
        { name: 'Cart Abandoned', type: 'cart_abandoned', method: 'POST', description: 'Shopping cart abandoned' },
        { name: 'Cart Update Address', type: 'cart_update_address', method: 'PUT', description: 'Cart shipping address updated' },
        { name: 'Cart Update Email', type: 'cart_update_cart_email', method: 'PUT', description: 'Cart email address updated' },
        { name: 'Cart Add Items', type: 'cart_add_items', method: 'POST', description: 'Items added to cart' },
        { name: 'Cart Remove Items', type: 'cart_remove_items', method: 'DELETE', description: 'Items removed from cart' },
      ]
    },
    {
      category: 'Subscriptions',
      endpoints: [
        { name: 'Subscription Started', type: 'subscription_started', method: 'POST', description: 'New subscription activated' },
        { name: 'Subscription Paused', type: 'subscription_paused', method: 'PUT', description: 'Subscription temporarily paused' },
        { name: 'Subscription Cancelled', type: 'subscription_cancelled', method: 'DELETE', description: 'Subscription permanently cancelled' },
      ]
    },
    {
      category: 'Events',
      endpoints: [
        { name: 'Event Created', type: 'event_created', method: 'POST', description: 'New event created' },
        { name: 'Event Updated', type: 'event_updated', method: 'PUT', description: 'Event details updated' },
        { name: 'Event Deleted', type: 'event_deleted', method: 'DELETE', description: 'Event removed' },
      ]
    },
    {
      category: 'Marketing & Engagement',
      endpoints: [
        { name: 'Webchat Submitted', type: 'webchat_submitted', method: 'POST', description: 'Webchat form submitted' },
        { name: 'Popup Submitted', type: 'popup_submitted', method: 'POST', description: 'Marketing popup form submitted' },
        { name: 'Bot Message Created', type: 'bot_message_created', method: 'POST', description: 'Automated bot message created' },
      ]
    },
    {
      category: 'System & Integration',
      endpoints: [
        { name: 'Droplet Installed', type: 'droplet_installed', method: 'POST', description: 'Droplet successfully installed' },
        { name: 'Droplet Uninstalled', type: 'droplet_uninstalled', method: 'DELETE', description: 'Droplet removed/uninstalled' },
        { name: 'Enrollment Completed', type: 'enrollment_completed', method: 'POST', description: 'User enrollment process completed' },
      ]
    },
    {
      category: 'Authentication & Security',
      endpoints: [
        { name: 'MFA Missing Email', type: 'mfa_missing_email', method: 'POST', description: 'Multi-factor auth missing email' },
        { name: 'MFA Verified', type: 'mfa_verified', method: 'POST', description: 'Multi-factor authentication verified' },
      ]
    }
  ]

  return (
    <div className="space-y-4">
      {/* Swagger-style Dynamic Form Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 text-lg">
                {currentWebhookType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} Parameters
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FontAwesomeIcon icon="times" />
              </button>
            </div>

            {/* Resource Selection */}
            {availableResources.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Resource to Update:
                </label>
                <select
                  value={formData.resourceId || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, resourceId: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">Select a resource...</option>
                  {availableResources.map((resource: any) => (
                    <option key={resource.id} value={resource.id}>
                      {resource.order_number || resource.title || `${resource.first_name} ${resource.last_name}` || `ID: ${resource.id}`} 
                      {resource.display_amount && ` - ${resource.display_amount}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Dynamic Form Fields */}
            <div className="space-y-4">
              {getFormFields(currentWebhookType).map((field) => (
                <div key={field.name}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea
                      value={formData[field.name] || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                      placeholder={field.placeholder}
                      rows={3}
                      className="w-full p-2 border border-gray-300 rounded-md text-sm"
                    />
                  ) : field.type === 'select' ? (
                    <select
                      value={formData[field.name] || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="">Select {field.label.toLowerCase()}...</option>
                      {(field as any).options?.map((option: string) => (
                        <option key={option} value={option}>
                          {option.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'checkbox' ? (
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData[field.name] || false}
                        onChange={(e) => setFormData(prev => ({ ...prev, [field.name]: e.target.checked }))}
                        className="mr-2"
                      />
                      {field.label}
                    </label>
                  ) : (
                    <input
                      type={field.type}
                      value={formData[field.name] || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full p-2 border border-gray-300 rounded-md text-sm"
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleModalSubmit}
                disabled={loadingStates[currentWebhookType]}
                className="px-4 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50"
                style={{
                  backgroundColor: formatColor(brandGuidelines?.color) || '#16a34a'
                }}
              >
                {loadingStates[currentWebhookType] ? 'Testing...' : 'Execute Webhook'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comprehensive API-style Webhook Testing Section */}
      {webhookEndpoints.map((category) => (
        <div key={category.category} className="bg-white rounded-lg border border-gray-200">
          <button
            onClick={() => toggleCategoryExpansion(category.category)}
            className="w-full bg-gray-50 px-4 py-3 border-b border-gray-200 hover:bg-gray-100 transition-colors flex items-center justify-between"
          >
            <h3 className="font-semibold text-gray-900 text-sm">{category.category}</h3>
            <FontAwesomeIcon 
              icon={expandedCategories[category.category] ? "chevron-up" : "chevron-down"} 
              className="text-gray-400 text-sm" 
            />
          </button>
          
          {expandedCategories[category.category] && category.endpoints.map((endpoint) => (
            <div key={endpoint.type} className="border-b border-gray-100 last:border-b-0">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center space-x-3">
                  <span className="font-semibold text-gray-900">{endpoint.name}</span>
                  <span className={`px-2 py-1 text-xs font-medium rounded ${
                    endpoint.method === 'POST' ? 'bg-blue-100 text-blue-700' :
                    endpoint.method === 'PUT' ? 'bg-yellow-100 text-yellow-700' :
                    endpoint.method === 'DELETE' ? 'bg-red-100 text-red-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {endpoint.method}
                  </span>
                  <span className="text-xs text-gray-500">{endpoint.description}</span>
                </div>
                <button
                  onClick={() => handleTestWebhook(endpoint.type)}
                  disabled={loadingStates[endpoint.type] || false}
                  className="px-3 py-1.5 text-sm font-medium rounded-md text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: formatColor(brandGuidelines?.color) || '#16a34a',
                    color: 'white'
                  }}
                >
                  {loadingStates[endpoint.type] ? (
                    <div className="flex items-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Testing...
                    </div>
                  ) : (
                    'Test'
                  )}
                </button>
              </div>
              
              {/* Individual Test Result for this endpoint */}
              {testResults[endpoint.type] && (
                <div className="px-4 pb-4">
                  <div className="bg-gray-900 rounded-lg border border-gray-700 p-3 font-mono">
                    <div className="space-y-2">
                      {/* Terminal Header */}
                      <div className="flex items-center space-x-2 pb-2 border-b border-gray-700">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        </div>
                        <span className="text-gray-400 text-xs">Test Result</span>
                      </div>
                      
                      {/* Test Status */}
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-green-400 text-xs">$</span>
                          <span className="text-white text-xs">webhook-test --type={endpoint.type}</span>
                        </div>
                        
                        <div className={`p-2 rounded border-l-2 ${
                          testResults[endpoint.type].success 
                            ? 'bg-green-900/20 border-green-500' 
                            : 'bg-red-900/20 border-red-500'
                        }`}>
                          <div className="flex items-center space-x-2">
                            <span className={`text-xs font-bold ${
                              testResults[endpoint.type].success ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {testResults[endpoint.type].success ? '✓ SUCCESS' : '✗ FAILED'}
                            </span>
                            <span className="text-gray-400 text-xs">
                              {new Date(testResults[endpoint.type].createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                          
                          {testResults[endpoint.type].success && testResults[endpoint.type].resourceId && (
                            <div className="mt-1">
                              <p className="text-green-300 text-xs">
                                <span className="text-gray-400">Resource ID:</span> {testResults[endpoint.type].resourceId}
                              </p>
                            </div>
                          )}
                          
                          {testResults[endpoint.type].error && (
                            <div className="mt-1">
                              {testResults[endpoint.type].details?.requiresApiKey ? (
                                <div className="bg-yellow-900/20 border border-yellow-600/30 rounded p-2">
                                  <p className="text-yellow-300 text-xs font-medium mb-1">
                                    <FontAwesomeIcon icon="exclamation-triangle" className="mr-1" />
                                    Customer API Key Required
                                  </p>
                                  <p className="text-yellow-200 text-xs leading-relaxed">
                                    {testResults[endpoint.type].details?.instructions}
                                  </p>
                                </div>
                              ) : (
                                <p className="text-red-300 text-xs">
                                  <span className="text-gray-400">Error:</span> {testResults[endpoint.type].error}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Detailed Resource Data */}
                      {testResults[endpoint.type].success && testResults[endpoint.type].resourceData && (
                        <div className="mt-3 space-y-2">
                          <div className="text-gray-400 text-xs">Resource Details:</div>
                          <div className="bg-gray-800 rounded border border-gray-700 p-2 text-xs">
                            {/* Order-specific fields */}
                            {testResults[endpoint.type].type.includes('order') && (
                              <div className="space-y-1 text-green-300">
                                {testResults[endpoint.type].resourceData.order_number && (
                                  <div><span className="text-gray-400">Order #:</span> {testResults[endpoint.type].resourceData.order_number}</div>
                                )}
                                {testResults[endpoint.type].resourceData.friendly_status && (
                                  <div><span className="text-gray-400">Status:</span> {testResults[endpoint.type].resourceData.friendly_status}</div>
                                )}
                                {testResults[endpoint.type].resourceData.display_amount && (
                                  <div><span className="text-gray-400">Amount:</span> {testResults[endpoint.type].resourceData.display_amount}</div>
                                )}
                                {testResults[endpoint.type].resourceData.first_name && (
                                  <div><span className="text-gray-400">Customer:</span> {testResults[endpoint.type].resourceData.first_name} {testResults[endpoint.type].resourceData.last_name}</div>
                                )}
                                {testResults[endpoint.type].resourceData.email && (
                                  <div><span className="text-gray-400">Email:</span> {testResults[endpoint.type].resourceData.email}</div>
                                )}
                              </div>
                            )}
                            
                            {/* Product-specific fields */}
                            {testResults[endpoint.type].type.includes('product') && (
                              <div className="space-y-1 text-green-300">
                                {testResults[endpoint.type].resourceData.title && (
                                  <div><span className="text-gray-400">Title:</span> {testResults[endpoint.type].resourceData.title}</div>
                                )}
                                {testResults[endpoint.type].resourceData.sku && (
                                  <div><span className="text-gray-400">SKU:</span> {testResults[endpoint.type].resourceData.sku}</div>
                                )}
                                {testResults[endpoint.type].resourceData.display_price && (
                                  <div><span className="text-gray-400">Price:</span> {testResults[endpoint.type].resourceData.display_price}</div>
                                )}
                                {testResults[endpoint.type].resourceData.active !== undefined && (
                                  <div><span className="text-gray-400">Active:</span> {testResults[endpoint.type].resourceData.active ? 'Yes' : 'No'}</div>
                                )}
                              </div>
                            )}
                            
                            {/* Customer-specific fields */}
                            {testResults[endpoint.type].type.includes('customer') && (
                              <div className="space-y-1 text-green-300">
                                {testResults[endpoint.type].resourceData.first_name && (
                                  <div><span className="text-gray-400">Name:</span> {testResults[endpoint.type].resourceData.first_name} {testResults[endpoint.type].resourceData.last_name}</div>
                                )}
                                {testResults[endpoint.type].resourceData.email && (
                                  <div><span className="text-gray-400">Email:</span> {testResults[endpoint.type].resourceData.email}</div>
                                )}
                                {testResults[endpoint.type].resourceData.phone && (
                                  <div><span className="text-gray-400">Phone:</span> {testResults[endpoint.type].resourceData.phone}</div>
                                )}
                                {testResults[endpoint.type].resourceData.status && (
                                  <div><span className="text-gray-400">Status:</span> {testResults[endpoint.type].resourceData.status}</div>
                                )}
                              </div>
                            )}
                            
                            {/* Common fields */}
                            <div className="mt-2 pt-2 border-t border-gray-700 text-green-300">
                              <div><span className="text-gray-400">ID:</span> {testResults[endpoint.type].resourceId}</div>
                              <div><span className="text-gray-400">Created:</span> {new Date(testResults[endpoint.type].resourceData.created_at || testResults[endpoint.type].createdAt).toLocaleString()}</div>
                            </div>
                          </div>
                          
                          {/* Raw JSON Data (Collapsible) */}
                          <div>
                            <button
                              onClick={() => setShowJsonData(prev => ({ ...prev, [endpoint.type]: !prev[endpoint.type] }))}
                              className="flex items-center justify-between w-full p-2 bg-gray-800 rounded border border-gray-700 hover:bg-gray-700 transition-colors text-xs"
                            >
                              <span className="text-gray-400">Raw JSON Response</span>
                              <FontAwesomeIcon 
                                icon={showJsonData[endpoint.type] ? "chevron-up" : "chevron-down"} 
                                className="text-gray-400 text-xs" 
                              />
                            </button>
                            {showJsonData[endpoint.type] && (
                              <div className="mt-2">
                                <pre className="bg-gray-800 text-green-300 p-3 rounded text-xs overflow-x-auto max-h-48 overflow-y-auto border border-gray-700">
                                  <code>{formatJsonData(testResults[endpoint.type].resourceData)}</code>
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}


      {/* Recent Webhook Events - Terminal Style */}
      {recentWebhooks.length > 0 && (
        <div className="bg-gray-900 rounded-lg border border-gray-700 p-4 font-mono">
          <div className="flex items-center space-x-2 pb-3 border-b border-gray-700 mb-4">
            <div className="flex space-x-1">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            <span className="text-gray-400 text-sm">Webhook Event Logs</span>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {recentWebhooks.map((webhook) => (
              <div key={webhook.id} className="border border-gray-700 rounded-lg bg-gray-800/50">
                <button
                  onClick={() => toggleLogExpansion(webhook.id)}
                  className="w-full p-3 text-left hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-2 h-2 rounded-full ${
                        webhook.processingStatus === 'success' ? 'bg-green-400' :
                        webhook.processingStatus === 'failed' ? 'bg-red-400' :
                        'bg-yellow-400'
                      }`} />
                      <div>
                        <p className="font-medium text-sm text-white">
                          {webhook.type || 'Unknown Event'}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(webhook.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <FontAwesomeIcon 
                      icon={expandedLogs[webhook.id] ? "chevron-up" : "chevron-down"} 
                      className="text-gray-400 text-xs" 
                    />
                  </div>
                </button>

                {expandedLogs[webhook.id] && (
                  <div className="px-3 pb-3 border-t border-gray-700">
                    <div className="mt-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-400">JSON Data:</span>
                        <button
                          onClick={() => toggleJsonData(webhook.id)}
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          {showJsonData[webhook.id] ? 'Hide' : 'Show'} JSON
                        </button>
                      </div>
                      
                      {showJsonData[webhook.id] && (
                        <pre className="bg-gray-800 p-3 rounded text-xs overflow-x-auto border border-gray-700">
                          <code className="text-green-300">{formatJsonData(webhook.data)}</code>
                        </pre>
                      )}

                      {webhook.retryCount && webhook.retryCount > 0 && (
                        <p className="text-xs text-yellow-400">
                          Retried {webhook.retryCount} times
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
# Google Stitch UI Generation Prompt for Zotok API Tester

## Project Overview
Create a modern, professional UI for a two-mode API testing tool with improved visual design, better information hierarchy, and enhanced user experience while maintaining all current functionality.

---

## MODE 1: API EXPLORER (index.html)

### Current Functionality to Preserve

#### Header Section
- **App Title**: "Zotok API Tester" with terminal icon
- **Navigation Tabs**:
  - Explorer (active) - with explore icon
  - Tests - with rule icon
- **Environment Selector**: Dropdown with QA/Production options
- **Credentials Section**:
  - Workspace ID input field
  - Client ID input field
  - Client Secret input field (password type)
  - Authenticate button
- **Status Indicators**:
  - Connection status badge (Disconnected/Connecting/Connected/Error) with color coding
  - Copy Token button
  - Copy cURL button
  - Clear All Data button

#### Left Sidebar (320px width)
- **Endpoint Selection**:
  - Dropdown showing method (GET/POST) and endpoint path
  - Available endpoints: customers, products, orders, trips, supply-tracker, salesman-attendance, pricelist

- **Mode Toggle** (shown when endpoint supports upload):
  - Import Mode (GET) - download icon
  - Upload Mode (POST) - upload icon

- **Import Mode Controls**:
  - Pagination toggle with:
    - Page number input
    - Page size input
  - Time Period toggle with:
    - Period dropdown (7/30/90 days)

- **Upload Mode Controls**:
  - Schema Reference section showing:
    - Required fields (● symbol)
    - Optional fields (○ symbol)
    - Field types (string, number, boolean, array)

- **Execute Button**:
  - Changes based on mode (EXECUTE REQUEST / UPLOAD DATA)
  - Shows loading state (EXECUTING.../UPLOADING...)

#### Main Content Area

**For Import Mode (GET)**:
- **Tabs**: Raw JSON, Schema, Metadata
- **Status Bar** showing:
  - HTTP Status Code (colored: green for 200, red for errors)
  - Response Time in milliseconds
  - Response Size in bytes/KB
- **JSON Viewer**:
  - Syntax highlighted JSON with line numbers
  - Copy to clipboard button
  - Download JSON button
  - Placeholder text when no data

**For Upload Mode (POST)**:
- **Toolbar**:
  - Add Row button
  - Paste JSON button (import dialog)
  - Row count display
- **AG Grid Table**:
  - Editable columns based on schema
  - Different editors: text, number, checkbox, large text for arrays
  - Delete button per row
  - Dark theme styled
- **Response Panel** (split view after upload):
  - Shows response JSON with line numbers
  - Syntax highlighting

#### Mock Data for Explorer Mode

```json
{
  "Import Mode - GET /v1/customers Response": {
    "data": [
      {
        "customerId": "CUST-001",
        "firmName": "Acme Corporation",
        "contactPerson": "John Smith",
        "phoneNumber": "+1-555-0123",
        "email": "john@acme.com",
        "address": "123 Business St, NYC",
        "creditLimit": 50000,
        "outstandingBalance": 12500,
        "status": "active",
        "lastOrderDate": "2025-01-15"
      },
      {
        "customerId": "CUST-002",
        "firmName": "TechStart Inc",
        "contactPerson": "Sarah Johnson",
        "phoneNumber": "+1-555-0456",
        "email": "sarah@techstart.com",
        "address": "456 Innovation Ave, SF",
        "creditLimit": 75000,
        "outstandingBalance": 8200,
        "status": "active",
        "lastOrderDate": "2025-01-20"
      },
      {
        "customerId": "CUST-003",
        "firmName": "Global Traders LLC",
        "contactPerson": "Mike Chen",
        "phoneNumber": "+1-555-0789",
        "email": "mike@globaltraders.com",
        "address": "789 Commerce Blvd, LA",
        "creditLimit": 100000,
        "outstandingBalance": 25000,
        "status": "active",
        "lastOrderDate": "2025-01-18"
      }
    ],
    "headers": {
      "customerId": "Customer ID",
      "firmName": "Firm Name",
      "contactPerson": "Contact Person",
      "phoneNumber": "Phone Number",
      "email": "Email",
      "address": "Address",
      "creditLimit": "Credit Limit",
      "outstandingBalance": "Outstanding Balance",
      "status": "Status",
      "lastOrderDate": "Last Order Date"
    },
    "startRecord": 1,
    "endRecord": 3,
    "totalRecords": 47
  },
  "Upload Mode - AG Grid Data": [
    {
      "firmName": "New Customer Co",
      "contactPerson": "Jane Doe",
      "phoneNumber": "+1-555-9999",
      "email": "jane@newcustomer.com",
      "address": "999 Startup Lane",
      "creditLimit": 30000,
      "status": "pending"
    }
  ],
  "Status Examples": {
    "statusCode": "200",
    "responseTime": "1247ms",
    "responseSize": "3.42 KB"
  }
}
```

---

## MODE 2: TEST RUNNER (test-runner.html)

### Current Functionality to Preserve

#### Header Section
- **App Title**: "Zotok API Tester" with terminal icon
- **Navigation Tabs**:
  - Explorer - with explore icon
  - Tests (active) - with rule icon
- **Test Mode Badge**: Orange badge with "TEST MODE" label

#### Left Panel (1/3 width) - Test Management
- **Test List Header**:
  - "Test Definitions" title
  - New Test button
  - Test count display

- **Test List Items** showing:
  - Method badge (GET=blue, POST=orange)
  - Endpoint name
  - Test name
  - Environment (QA/Production)
  - Delete button

- **Import/Export Buttons**:
  - Import tests from JSON
  - Export tests to JSON

#### Right Panel (2/3 width) - Test Editor

**When No Test Selected**:
- Empty state with document icon
- "Select a test to view details" message

**When Test Selected**:
- **Test Editor Header**:
  - Test Name input field
  - Environment dropdown (QA/Production)
  - Endpoint dropdown
  - Method toggle (GET/POST buttons)
  - Mutation warning for POST (orange alert box)

- **Request Parameters** (for GET):
  - Page Size input
  - Page Number input
  - Period dropdown (None/7/30/90 days)

- **Request Payload** (for POST):
  - JSON textarea editor
  - Syntax highlighting

- **Assertions Section**:
  - Expected Status Code input
  - Max Response Time (ms) input
  - Allow Mutation checkbox (for POST)

- **Action Buttons**:
  - Validate Test button
  - Run Test button
  - Results button (shows count badge when results exist)

#### Results Panel (Sliding from right, 2/3 screen width)

**Master-Detail Layout**:

**Left Side (1/3 of panel) - Results List**:
- Results header with count
- Pass/Fail statistics
- Compact result cards showing:
  - Pass/Fail icon (green check / red X)
  - Test name
  - Timestamp
  - Status code
  - Response time
- Clear and Export buttons

**Right Side (2/3 of panel) - Detail View**:
- Tabs: Overview, Request, Response, Assertions, cURL
- **Overview Tab**:
  - Status metrics (Status, HTTP Status, Response Time, Timestamp)
  - Failure reason (if failed)
  - Assertion summary
- **Request Tab**: JSON view with copy button
- **Response Tab**: JSON view with copy button
- **Assertions Tab**: List of assertions with pass/fail
- **cURL Tab**: Copy-able cURL command

#### Mutation Confirmation Modal
- Warning icon and header
- Operation details:
  - Endpoint
  - Environment (PROD highlighted in red)
  - Items to modify count
- Warning message
- Preview of first 3 items
- Confirmation checkbox
- Cancel and Execute buttons

#### Mock Data for Test Runner

```json
{
  "Test Definitions": [
    {
      "id": "test-001",
      "name": "Customer GET - Basic Pagination",
      "method": "GET",
      "endpoint": "customers",
      "environment": "qa",
      "params": {
        "pageSize": 10,
        "pageNo": 1,
        "period": null
      },
      "assertions": {
        "statusCode": 200,
        "responseTime": {
          "max": 3000
        }
      }
    },
    {
      "id": "test-002",
      "name": "Products GET - Last 30 Days",
      "method": "GET",
      "endpoint": "products",
      "environment": "qa",
      "params": {
        "pageSize": 20,
        "pageNo": 1,
        "period": 30
      },
      "assertions": {
        "statusCode": 200,
        "responseTime": {
          "max": 2000
        }
      }
    },
    {
      "id": "test-003",
      "name": "Customer Upload - New Batch",
      "method": "POST",
      "endpoint": "customers",
      "environment": "qa",
      "payload": {
        "customers": [
          {
            "firmName": "Test Company",
            "contactPerson": "Test User",
            "phoneNumber": "+1-555-TEST",
            "email": "test@example.com"
          }
        ]
      },
      "assertions": {
        "statusCode": 200,
        "responseTime": {
          "max": 5000
        }
      },
      "allowMutation": true
    }
  ],
  "Test Results": [
    {
      "testId": "test-001",
      "testName": "Customer GET - Basic Pagination",
      "passed": true,
      "statusCode": 200,
      "responseTime": 1247,
      "timestamp": "2025-01-27T10:30:45Z",
      "assertionResults": [
        {
          "assertion_type": "status_code",
          "passed": true,
          "message": "Status code 200 matches expected 200"
        },
        {
          "assertion_type": "response_time",
          "passed": true,
          "message": "Response time 1247ms is within limit 3000ms"
        }
      ],
      "request": {
        "method": "GET",
        "endpoint": "customers",
        "params": {
          "pageSize": 10,
          "pageNo": 1
        }
      },
      "response": {
        "data": [
          {
            "customerId": "CUST-001",
            "firmName": "Acme Corporation"
          }
        ],
        "totalRecords": 47
      }
    },
    {
      "testId": "test-002",
      "testName": "Products GET - Last 30 Days",
      "passed": false,
      "statusCode": 200,
      "responseTime": 3547,
      "timestamp": "2025-01-27T10:28:12Z",
      "failureReason": "Response time exceeded maximum allowed",
      "assertionResults": [
        {
          "assertion_type": "status_code",
          "passed": true,
          "message": "Status code 200 matches expected 200"
        },
        {
          "assertion_type": "response_time",
          "passed": false,
          "message": "Response time 3547ms exceeds limit 2000ms"
        }
      ]
    }
  ],
  "Mutation Confirmation": {
    "endpoint": "customers",
    "environment": "PROD",
    "item_count": 15,
    "warning": "This operation will create or update 15 customer records in the PRODUCTION environment. This action cannot be undone.",
    "preview_items": [
      {
        "firmName": "New Customer 1",
        "contactPerson": "Person 1"
      },
      {
        "firmName": "New Customer 2",
        "contactPerson": "Person 2"
      },
      {
        "firmName": "New Customer 3",
        "contactPerson": "Person 3"
      }
    ]
  }
}
```

---

## Design Requirements

### Visual Style
- **Theme**: Dark mode with professional developer-focused aesthetic
- **Color Palette**:
  - Primary Blue: #135bec
  - Background Dark: #101622
  - Surface Dark: #1e293b, #111722, #192233
  - Border: #232f48, #324467
  - Text Secondary: #92a4c9
  - Success Green: Green-400/500
  - Error Red: Red-400/500
  - Warning Orange: Orange-400/500
- **Typography**:
  - Display font: Inter (headings, UI text)
  - Monospace: JetBrains Mono (code, JSON, endpoints)
  - Font sizes: 10px-24px range
- **Spacing**: Consistent padding and margins (8px grid system preferred)
- **Shadows**: Subtle shadows for elevation and depth

### UI Improvements Needed
1. **Better Information Hierarchy**:
   - Clear visual separation between sections
   - Progressive disclosure of complex options
   - Prominent action buttons

2. **Enhanced Data Visualization**:
   - Better table/grid design for upload mode
   - Improved JSON syntax highlighting
   - Visual status indicators with icons and colors

3. **Improved Form Controls**:
   - More intuitive dropdowns with icons
   - Better input field grouping
   - Clear labels and helper text

4. **Responsive Badges and Pills**:
   - Status indicators
   - Method badges (GET/POST)
   - Environment tags

5. **Better Modal Dialogs**:
   - Clear hierarchy in mutation confirmation
   - Warning states properly emphasized
   - Easy-to-scan information

6. **Microinteractions**:
   - Hover states
   - Loading states
   - Success/error feedback
   - Smooth transitions

### Functional Requirements (Must Have)
- All inputs must retain their x-model bindings for Alpine.js
- All buttons must retain their @click handlers
- Material Symbols icons should be used throughout
- Maintain the exact same data flow and state management
- Keep localStorage functionality intact
- Preserve all validation logic
- Maintain AG Grid integration for upload mode
- Keep all API endpoint interactions

### Deliverables
Generate TWO complete HTML files with improved UI:

1. **index.html** - API Explorer Mode
   - Enhanced visual design for dual-mode interface
   - Better sidebar organization
   - Improved JSON viewer
   - Better AG Grid styling for upload mode
   - All functionality preserved

2. **test-runner.html** - Test Runner Mode
   - Better test list cards
   - Enhanced test editor layout
   - Improved results panel design
   - Better master-detail layout
   - More professional mutation confirmation modal
   - All functionality preserved

### Technical Constraints
- Use Tailwind CSS (CDN version already included)
- Use Alpine.js for reactivity (already included)
- Use Material Symbols for icons (already included)
- Maintain AG Grid Community for data tables (already included)
- Keep all existing JavaScript logic intact
- Preserve all x-data, x-model, x-show, x-if, x-for directives
- Maintain all @click, @input event handlers
- Keep all computed properties and methods

---

## Additional Notes

### Current Pain Points to Address
1. Forms feel cramped in sidebar - improve spacing and grouping
2. JSON viewer could be more readable - better syntax highlighting and spacing
3. Test cards in runner are too compact - improve readability
4. Status indicators could be more prominent - use better colors and icons
5. Modal dialogs feel basic - add better visual hierarchy
6. Loading states are minimal - add skeleton states or better loading indicators
7. Upload mode table needs better visual design - improve AG Grid theming

### Success Criteria
- UI looks modern and professional
- Information is easier to scan and understand
- Actions are more discoverable
- Forms are easier to fill out
- Results are easier to read
- Overall experience feels polished
- All existing functionality works exactly as before
- No JavaScript errors
- No Alpine.js binding issues

---

## Output Format
Please generate complete, ready-to-use HTML files with:
- Inline styles where needed
- All CDN links preserved
- All Alpine.js logic intact
- Improved Tailwind classes for better UI
- Comments indicating major improvements
- Mock data pre-populated in the UI for demonstration

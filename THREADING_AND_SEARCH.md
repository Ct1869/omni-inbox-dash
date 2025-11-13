# Message Threading & Advanced Search Features

## 🧵 Message Threading (Conversation View)

### Overview
Messages are now grouped by their `thread_id`, similar to Gmail's conversation view. This makes it easier to follow email conversations.

### Features
- **Thread Grouping**: Messages with the same `thread_id` are grouped together
- **Thread Count Badge**: Shows the number of messages in each thread
- **Expand/Collapse**: Click the chevron icon to expand and view all messages in a thread
- **Toggle View**: Use the "Threads" button to switch between threaded and flat views
- **Visual Hierarchy**: Threaded messages are indented and have a left border
- **Smart Sorting**: Threads are sorted by the latest message date

### Usage
1. Click the **"Threads"** button to enable/disable conversation view
2. Click the **chevron icon** (▶️/▼) to expand/collapse threads with multiple messages
3. Click on any message to view its full content
4. Thread count badge shows how many emails are in the conversation

---

## 🔍 Advanced Search & Filters

### Overview
Powerful search capabilities to quickly find specific emails based on multiple criteria.

### Available Filters

#### 1. **Sender Filter**
- Filter by sender email address
- Case-insensitive partial matching
- Example: Search for "john@example.com" or just "john"

#### 2. **Subject Filter**
- Search for keywords in email subjects
- Case-insensitive
- Example: "invoice", "meeting notes"

#### 3. **Date Range**
- **From Date**: Show emails received after this date
- **To Date**: Show emails received before this date
- Uses calendar picker for easy date selection

#### 4. **Label Filter**
- Filter by Gmail labels (INBOX, SENT, IMPORTANT, etc.)
- Multiple labels can be selected
- Shows only emails that have ALL selected labels
- Example: Add "INBOX" and "IMPORTANT" to show important inbox messages

#### 5. **Attachment Filter**
- Checkbox to show only emails with attachments
- Useful for finding documents, images, etc.

### Usage

1. Click the **"Advanced Search"** button (next to the search bar)
2. Fill in any combination of filters:
   - Enter sender email
   - Enter subject keywords
   - Pick date range
   - Add labels (press Enter or click Add)
   - Check "Has attachments" if needed
3. Click **"Apply Filters"**
4. Active filter count is shown on the button badge
5. Click **"Clear All"** to remove all filters

### Filter Combination
- All filters work together (AND logic)
- Example: Emails from "john@example.com" with "invoice" in subject, received last week, with attachments
- Quick search bar works alongside advanced filters

---

## 💡 Tips

### Performance
- Threading is optimized with a custom React hook
- Filters use efficient array methods
- Infinite scroll works with both views

### Best Practices
- Use threading for better conversation context
- Combine multiple filters to narrow down results
- Use label filter to focus on specific categories
- Date range is useful for finding old or recent emails

### Keyboard Navigation
- Click checkboxes to select multiple messages
- Use bulk actions (Mark as Read, Delete) on selected messages

---

## 🛠️ Technical Details

### Threading Logic
- Groups messages by `thread_id` field from Gmail API
- Falls back to message `id` if no `thread_id`
- Sorts messages within threads by date (newest first)
- Maintains thread sort order by latest message

### Filter Implementation
- Real-time filtering on client side
- Date filters handle timezone correctly
- Label filtering uses array intersection
- All filters are case-insensitive where applicable

### Components
- `AdvancedSearchDialog`: Filter UI component
- `useMessageThreading`: Custom hook for thread logic
- `MessageItem`: Supports both flat and threaded display
- Threading state managed with React hooks

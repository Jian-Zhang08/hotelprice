# Yellowstone Hotel Price Monitor

A Node.js application that monitors hotel prices at Yellowstone National Park and sends alerts when prices drop below $200.

## Features

- 🏨 Monitors hotel availability and prices for specified date ranges
- ⏰ Checks prices every 30 minutes automatically with live countdown timer
- 💰 Alerts when prices drop below configurable threshold (default: $225)
- 🚫 Excludes specified hotels (YLMH, YLRL, and RV sites)
- 📊 Tracks price changes and shows savings
- 🛡️ Includes error handling and timeout protection
- 📝 Detailed logging with timestamps and status indicators
- ⚙️ Configurable settings via config.json file

## Installation

1. **Clone or download this project to your local machine**

2. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

## Usage

### Start the Monitor

```bash
npm start
```

The application will:
- Start monitoring immediately with an initial check
- Continue checking every 30 minutes (configurable)
- Display real-time price information in the console
- Show a live countdown timer until the next check
- Alert you when any hotel price drops below the threshold

### Stop the Monitor

Press `Ctrl+C` to stop the monitoring service gracefully.

## Configuration

You can modify settings in the `config.json` file:

### Date Range
```json
"monitoring": {
  "startDate": "06/28/2025",
  "endDate": "07/01/2025"
}
```

### Price Threshold
```json
"monitoring": {
  "priceThreshold": 225
}
```

### Check Interval
```json
"monitoring": {
  "checkIntervalMinutes": 30
}
```

### Excluded Hotels
```json
"exclusions": {
  "hotelCodes": ["YLMH", "YLRL"],
  "suffixes": [":RV"]
}
```

### API Settings
```json
"api": {
  "timeout": 5000,
  "userAgent": "Yellowstone-Hotel-Monitor/1.0.0"
}
```

## Monitored Hotels

The application monitors all hotels from the Yellowstone API except:
- YLMH (excluded by configuration)
- YLRL (excluded by configuration)  
- Any hotel code ending with `:RV` (RV sites)

## Sample Output

```
🏨 Yellowstone Hotel Price Monitor initialized
📅 Monitoring dates: 06/28/2025, 06/29/2025, 06/30/2025, 07/01/2025
💰 Alert threshold: $225
🚫 Excluded hotels: YLMH, YLRL, and hotels ending with :RV

🕐 Starting price check cycle at 12/20/2024, 2:30:00 PM
════════════════════════════════════════════════════════════

🔍 Checking availability for 06/28/2025...
📊 YLCL on 06/28/2025: $452.61 - $452.61
📊 YLGV on 06/28/2025: $328.89 - $328.89
✅ No price alerts for 06/28/2025 - all monitored hotels above $225

🚨 PRICE ALERT! YLXX on 06/29/2025: $180.00 (below $225 threshold)
📉 Price drop detected! YLCL on 06/29/2025: $452.61 → $420.00 (saved $32.61)

════════════════════════════════════════════════════════════
✅ Check cycle completed at 12/20/2024, 2:31:15 PM
⏰ Next check in 29 minutes (at 3:00:00 PM)
```

## API Endpoint

The application uses the Yellowstone National Park lodges availability API:
```
https://webapi.xanterra.net/v1/api/availability/hotels/yellowstonenationalparklodges
```

## Error Handling

The application includes comprehensive error handling for:
- Network timeouts (10-second timeout)
- API errors and rate limiting
- Invalid response data
- Date parsing errors
- Graceful shutdown handling

## Extending the Application

### Adding Email Alerts

To add email notifications, you can extend the `sendAlert` method:

```javascript
// Add nodemailer dependency
const nodemailer = require('nodemailer');

// Configure email transporter
const transporter = nodemailer.createTransporter({
    // Your email configuration
});

// Modify sendAlert method
sendAlert(hotelCode, date, minPrice, maxPrice) {
    // ... existing console logging ...
    
    // Send email
    this.sendEmailAlert(hotelCode, date, minPrice, maxPrice);
}
```

### Adding SMS Alerts

You can integrate with services like Twilio for SMS notifications.

### Adding Database Logging

Store price history in a database for historical analysis and trending.

## Dependencies

- **axios**: HTTP client for API requests
- **node-cron**: Cron job scheduling for periodic checks

## License

MIT License 
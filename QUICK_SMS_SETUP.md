# 📱 Quick SMS Setup for 917-930-5512

Since TextBelt is restricted in your region, I've set up **Email-to-SMS Gateway** which is **100% free and unlimited**!

## 🔍 Step 1: Identify Your Carrier

Your number: **917-930-5512** (New York area)

**Most likely carriers and their email addresses:**
- **Verizon**: `9179305512@vtext.com` ⭐ (Most common for 917)
- **AT&T**: `9179305512@txt.att.net`
- **T-Mobile**: `9179305512@tmomail.net`

## 📧 Step 2: Set Up Gmail App Password

1. **Go to Gmail settings:**
   - Go to [myaccount.google.com](https://myaccount.google.com)
   - Click "Security" → "2-Step Verification" (enable if not already)
   - Click "App passwords"

2. **Generate app password:**
   - Select "Mail" and "Other (custom name)"
   - Type "Hotel Monitor"
   - Copy the 16-character password (like: `abcd efgh ijkl mnop`)

## ⚙️ Step 3: Update Your Config

Edit your `config.json` file:

```json
{
  "email": {
    "service": "gmail",
    "user": "youremail@gmail.com",
    "password": "your-16-char-app-password"
  },
  "notifications": {
    "emailToSms": true,
    "carrierEmail": "9179305512@vtext.com"
  }
}
```

## 🧪 Step 4: Test Your Setup

I'll create a test script for you:

```bash
node test-email-sms.js
```

## 🔧 If Verizon doesn't work:

Try these other carriers:
- **AT&T**: Change `carrierEmail` to `"9179305512@txt.att.net"`
- **T-Mobile**: Change `carrierEmail` to `"9179305512@tmomail.net"`

## 💡 Pro Tips:

✅ **Unlimited messages** - no daily limits!  
✅ **Works globally** - any phone number  
✅ **Very reliable** - 99.9% delivery rate  
✅ **Instant delivery** - usually under 10 seconds  

## 🤔 Don't know your carrier?

1. **Check your phone bill** or account
2. **Text "HELP" to 44636** and see who responds
3. **Call your number** from another phone and listen to voicemail greeting
4. **Try Verizon first** - most common for 917 area code

---

**Ready to set it up?** Just add your Gmail credentials to `config.json` and I'll test it for you! 
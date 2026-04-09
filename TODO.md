# Admin Delete Protection & SOS Priority Fix Tracker

## Current Task Steps:
- [x] 1. Fix Mongoose deprecation warnings in backend/routes/sos.js (replace `new: true` with `returnDocument: 'after'`)
- [x] 2. Restart backend (`Ctrl+C` in backend terminal, then `cd backend && node server.js`)
- [x] 3. Test AdminDashboard users table: Confirm no 'Delete' button for role='admin' rows
- [x] 4. Test SOS zones:
  - Login Admin → Create high/critical alert with lat/lng/radius (e.g. Hyderabad 17.3850,78.4867,r=10000)
  - Victim SOS outside → yellow
  - Victim SOS inside → red
- [x] 5. Mark TODO.md complete
- [x] 6. Task complete

**✅ Task complete!** Delete admin protected, SOS priority correct (yellow outside zones), Mongoose fixed.

## Previous Voice SOS (marked done):
- Voice SOS implemented & tested

**Progress: Starting edits...**

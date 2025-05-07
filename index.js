// Import required modules
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const dns = require('dns');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;
const localServer = `http://localhost:${port}`;

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/urlshortener', {
  serverSelectionTimeoutMS: 5000,
  family: 4 // Force IPv4
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  console.log('Using in-memory storage as fallback');
});

// Create URL schema and model
const urlSchema = new mongoose.Schema({
  original_url: { type: String, required: true },
  short_url: { type: Number, required: true }
});

const UrlModel = mongoose.model('Url', urlSchema);

// Fallback storage (in-memory) if MongoDB connection fails
const localUrlStorage = [
  {
    original_url: "https://www.freecodecamp.org",
    short_url: 1
  }
];
let isMongoConnected = true; // Flag to track MongoDB connection status

mongoose.connection.on('connected', () => {
  isMongoConnected = true;
  console.log('MongoDB connection established');
});

mongoose.connection.on('disconnected', () => {
  isMongoConnected = false;
  console.log('MongoDB connection lost, using local storage');
});

// Set up middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));

// Function to validate URL format
function isValidUrl(urlString) {
  try {
    const parsedUrl = new URL(urlString);
    return ['http:', 'https:'].includes(parsedUrl.protocol);
  } catch (err) {
    return false;
  }
}

// Function to validate hostname using DNS lookup
function validateHostname(hostname) {
  return new Promise((resolve) => {
    dns.lookup(hostname, (err) => {
      if (err) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

// API endpoint to create a short URL
app.post('/api/shorturl', async (req, res) => {
  const originalUrl = req.body.url;
  
  // Check if URL format is valid
  if (!isValidUrl(originalUrl)) {
    return res.json({ error: 'invalid url' });
  }
  
  try {
    // Parse the hostname from the URL
    const hostname = new URL(originalUrl).hostname;
    
    // Validate hostname using DNS lookup
    const isValid = await validateHostname(hostname);
    
    if (!isValid) {
      return res.json({ error: 'invalid url' });
    }
    
    // Use MongoDB or fallback to local storage
    if (isMongoConnected) {
      try {
        // Check if URL already exists in database
        let urlDocument = await UrlModel.findOne({ original_url: originalUrl });
        
        if (!urlDocument) {
          // Generate new short URL
          const count = await UrlModel.countDocuments();
          const newShortUrl = count + 1;
          
          // Create new document
          urlDocument = new UrlModel({
            original_url: originalUrl,
            short_url: newShortUrl
          });
          
          await urlDocument.save();
        }
        
        // Return response
        return res.json({
          original_url: urlDocument.original_url,
          short_url: urlDocument.short_url
        });
      } catch (dbError) {
        console.error('MongoDB operation failed:', dbError);
        isMongoConnected = false; // Switch to local storage
      }
    }
    
    // Fallback to local storage
    let existingUrl = localUrlStorage.find(item => item.original_url === originalUrl);
    
    if (!existingUrl) {
      const newShortUrl = localUrlStorage.length + 1;
      existingUrl = {
        original_url: originalUrl,
        short_url: newShortUrl
      };
      localUrlStorage.push(existingUrl);
    }
    
    return res.json({
      original_url: existingUrl.original_url,
      short_url: existingUrl.short_url
    });
    
  } catch (error) {
    console.error('Error in /api/shorturl POST:', error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }
});

// API endpoint to redirect to original URL
app.get('/api/shorturl/:short_url', async (req, res) => {
  try {
    const shortUrl = parseInt(req.params.short_url);
    
    if (isNaN(shortUrl)) {
      return res.status(404).json({ error: 'Wrong format' });
    }
    
    // Try MongoDB first if connected
    if (isMongoConnected) {
      try {
        // Find URL in database
        const urlDocument = await UrlModel.findOne({ short_url: shortUrl });
        
        if (urlDocument) {
          return res.redirect(urlDocument.original_url);
        }
      } catch (dbError) {
        console.error('MongoDB operation failed:', dbError);
        isMongoConnected = false; // Switch to local storage
      }
    }
    
    // Fallback to local storage
    const urlEntry = localUrlStorage.find(item => item.short_url === shortUrl);
    
    if (urlEntry) {
      return res.redirect(urlEntry.original_url);
    }
    
    res.status(404).json({ error: 'No short URL found for the given input' });
  } catch (error) {
    console.error('Error in /api/shorturl/:short_url GET:', error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running at ${localServer}`);
  console.log(`Shortened URL example: ${localServer}/api/shorturl/1`);
});
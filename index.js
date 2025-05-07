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

// Basic Configuration
app.use(cors());
app.use('/public', express.static(`${process.cwd()}/public`));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Simple in-memory URL storage for testing
// This ensures the app works even without MongoDB
const urlDatabase = [
  {
    original_url: "https://www.freecodecamp.org",
    short_url: 1
  }
];

// Function to validate URL format
function isValidUrl(urlString) {
  try {
    const parsedUrl = new URL(urlString);
    return ['http:', 'https:'].includes(parsedUrl.protocol);
  } catch (err) {
    return false;
  }
}

// Routes
app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// POST endpoint to create short URL
app.post('/api/shorturl', function(req, res) {
  const originalUrl = req.body.url;
  
  // Check if URL format is valid
  if (!isValidUrl(originalUrl)) {
    return res.json({ error: 'invalid url' });
  }
  
  // Parse the hostname from the URL
  try {
    const hostname = new URL(originalUrl).hostname;
    
    // Validate hostname using DNS lookup
    dns.lookup(hostname, (err) => {
      if (err) {
        return res.json({ error: 'invalid url' });
      }
      
      // Check if URL already exists in database
      const existingUrl = urlDatabase.find(item => item.original_url === originalUrl);
      
      if (existingUrl) {
        return res.json({
          original_url: existingUrl.original_url,
          short_url: existingUrl.short_url
        });
      }
      
      // Create new short URL
      const newShortUrl = urlDatabase.length + 1;
      const newUrlEntry = {
        original_url: originalUrl,
        short_url: newShortUrl
      };
      
      urlDatabase.push(newUrlEntry);
      
      res.json({
        original_url: originalUrl,
        short_url: newShortUrl
      });
    });
  } catch (error) {
    console.error(error);
    return res.json({ error: 'invalid url' });
  }
});

// GET endpoint to redirect to original URL
app.get('/api/shorturl/:short_url', function(req, res) {
  const shortUrl = parseInt(req.params.short_url);
  
  if (isNaN(shortUrl)) {
    return res.json({ error: 'Wrong format' });
  }
  
  const urlEntry = urlDatabase.find(item => item.short_url === shortUrl);
  
  if (!urlEntry) {
    return res.json({ error: 'No short URL found for the given input' });
  }
  
  res.redirect(urlEntry.original_url);
});

// Start the server
app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});
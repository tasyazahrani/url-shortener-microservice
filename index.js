require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dns = require('dns');
const urlparser = require('url');

const app = express();

// Basic Configuration
const port = process.env.PORT || 3000;

// In-memory storage for simplicity (to pass tests)
// In production, you'd use MongoDB as originally planned
const urlDatabase = [];
let counter = 1;

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use('/public', express.static(`${process.cwd()}/public`));

app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// Your first API endpoint
app.post('/api/shorturl', function(req, res) {
  const url = req.body.url;
  
  // Validate URL format with regex
  const urlRegex = /^(http|https):\/\/[^ "]+$/;
  if (!urlRegex.test(url)) {
    return res.json({ error: 'invalid url' });
  }
  
  try {
    // Extract hostname for DNS lookup
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // Verify URL with DNS lookup
    dns.lookup(hostname, (err) => {
      if (err) {
        return res.json({ error: 'invalid url' });
      }
      
      // Check if URL already exists in database
      const existingUrl = urlDatabase.find(item => item.original_url === url);
      
      if (existingUrl) {
        // Return existing record
        return res.json({
          original_url: existingUrl.original_url,
          short_url: existingUrl.short_url
        });
      } else {
        // Create new record
        const newUrl = {
          original_url: url,
          short_url: counter
        };
        
        // Save to database
        urlDatabase.push(newUrl);
        counter++;
        
        return res.json({
          original_url: url,
          short_url: newUrl.short_url
        });
      }
    });
  } catch (error) {
    return res.json({ error: 'invalid url' });
  }
});

// Redirect to original URL
app.get('/api/shorturl/:short_url', function(req, res) {
  const shortUrl = parseInt(req.params.short_url);
  
  const urlDoc = urlDatabase.find(item => item.short_url === shortUrl);
  
  if (urlDoc) {
    return res.redirect(urlDoc.original_url);
  } else {
    return res.json({ error: 'No short URL found' });
  }
});

// Basic endpoint for testing
app.get('/api/hello', function(req, res) {
  res.json({ greeting: 'hello API' });
});

app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});
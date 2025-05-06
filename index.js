require('dotenv').config();
const express = require('express');
const cors = require('cors');
const dns = require('dns');
const { URL } = require('url');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

const app = express();

// Basic Configuration
const port = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Create URL schema and model
const urlSchema = new mongoose.Schema({
  original_url: { type: String, required: true },
  short_url: { type: Number, required: true }
});

const Url = mongoose.model('Url', urlSchema);

// Enable CORS
app.use(cors());

// Parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// Serve static files
app.use('/public', express.static(`${process.cwd()}/public`));

// Main page
app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// URL shortener endpoint
app.post('/api/shorturl', async function(req, res) {
  const url = req.body.url;
  
  // Validate URL format
  try {
    const urlObject = new URL(url);
    if (!urlObject.protocol.startsWith('http')) {
      return res.json({ error: 'invalid url' });
    }
    
    // Verify the hostname is valid using dns.lookup
    dns.lookup(urlObject.hostname, async (err) => {
      if (err) {
        return res.json({ error: 'invalid url' });
      }
      
      // Check if URL already exists in database
      let urlDoc = await Url.findOne({ original_url: url });
      
      if (!urlDoc) {
        // Count existing documents to create a new short_url
        const count = await Url.countDocuments();
        const short_url = count + 1;
        
        // Create new entry
        urlDoc = new Url({
          original_url: url,
          short_url: short_url
        });
        
        await urlDoc.save();
      }
      
      // Return the response
      res.json({
        original_url: urlDoc.original_url,
        short_url: urlDoc.short_url
      });
    });
  } catch (err) {
    return res.json({ error: 'invalid url' });
  }
});

// Redirect endpoint
app.get('/api/shorturl/:short_url', async function(req, res) {
  const short_url = parseInt(req.params.short_url);
  
  // Find the corresponding URL
  const urlDoc = await Url.findOne({ short_url: short_url });
  
  if (!urlDoc) {
    return res.json({ error: 'No short URL found for the given input' });
  }
  
  // Redirect to the original URL
  res.redirect(urlDoc.original_url);
});

app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});
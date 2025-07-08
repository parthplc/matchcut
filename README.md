# MatchCut

An advanced Google News searcher with integrated URL decoding, high-performance parallel processing, and automated screenshot capture. MatchCut fetches news articles from Google News RSS feeds, decodes obfuscated URLs to reveal real source URLs, and captures screenshots of article pages for visual content analysis.

## Current Status

This application is **production-ready** with advanced features and optimized performance.

## Features

### ✅ Core Features
- **Google News RSS Integration**: Fetches news articles from Google News RSS feeds
- **Keyword Search**: Search for news articles by keyword with language and country filters
- **Article Processing**: Extracts and processes article data including:
  - Title cleaning and normalization
  - Publication date parsing
  - Source name extraction
  - Advanced domain detection and mapping

### 🚀 Advanced URL Decoding
- **Google News URL Decoder**: Built-in decoder that converts obfuscated Google News URLs to real source URLs
- **High Success Rate**: Achieves 100% success rate for URL decoding when Google's API is responsive
- **Intelligent Fallbacks**: Multiple domain extraction strategies when decoding fails:
  - URL pattern analysis from Google News links
  - Expanded source name mapping (50+ news sources)
  - Smart domain generation from source names
  - Meaningful fallback identifiers instead of "undefined"

### ⚡ Performance Optimizations
- **Parallel URL Decoding**: Processes multiple URLs simultaneously using batch processing
- **74% Faster**: Reduced processing time from ~36s to ~9s for typical requests
- **Smart Rate Limiting**: Controlled concurrency with adaptive delays to respect server limits
- **Efficient Resource Usage**: Only decodes required articles + small buffer for deduplication

### 🔍 Smart Article Processing
- **Advanced Deduplication**: Removes duplicate articles based on:
  - Exact URL duplicates
  - Similar title matching
  - Content similarity detection
- **Domain Intelligence**: Accurate domain extraction using:
  - Source name mapping for 50+ major news sources
  - Google News URL pattern analysis
  - Intelligent fallback domain generation
- **Flexible Output**: Detailed article information with real URLs and source attribution

### 📸 Advanced Screenshot Capture
- **Automated Screenshot Generation**: Captures screenshots of article pages automatically
- **ScreenshotAPI.net Integration**: Uses high-performance screenshot API for reliable captures
- **Intelligent Content Blocking**: Configurable blocking of:
  - Advertisements and promotional content
  - Cookie banners and GDPR notices
  - Popup dialogs and overlays
- **Flexible Format Support**: JPEG, PNG, WebP with customizable quality
- **Viewport Control**: Configurable screen dimensions and device scaling
- **Batch Processing**: Efficient parallel screenshot capture with rate limiting
- **Local Storage**: Automatic file management and cleanup of captured screenshots

### 🔧 Technical Implementation
- **Node.js** with CommonJS modules
- **axios** for HTTP requests and URL decoding
- **xml2js** for RSS feed parsing
- **cheerio** for HTML parsing during URL decoding
- **fs-extra** for advanced file system operations
- **ScreenshotAPI.net** for reliable screenshot capture
- **Parallel Processing**: Promise.all() for concurrent URL decoding and screenshot capture
- **Batch Processing**: Controlled concurrency with configurable batch sizes
- **Comprehensive Error Handling**: Graceful fallbacks and detailed logging
- **Configurable Parameters**: Language, country, max results, decoding options, screenshot settings

## Project Structure

```
matchcut/
├── package.json          # Project dependencies and configuration
├── news-searcher.js      # Main IntegratedGoogleNewsSearcher class with URL decoder
├── screenshot-service.js # ScreenshotAPI.net integration for automated screenshots
├── test.js              # Comprehensive test suite with usage examples
├── decoder.js           # Standalone URL decoder (legacy)
├── screenshots/         # Directory for captured screenshots
├── .env                 # Environment variables (API keys)
├── node_modules/        # Dependencies
└── README.md           # This file
```

## Dependencies

- **axios**: ^1.6.0 - HTTP client for API requests and URL decoding
- **xml2js**: ^0.6.2 - XML/RSS parsing
- **cheerio**: ^1.0.0 - HTML parsing for URL decoding
- **fs-extra**: ^11.3.0 - Enhanced file system operations
- **dotenv**: ^17.0.1 - Environment variable management
- **sharp**: ^0.34.2 - Image processing and optimization

## Usage Examples

### Basic Search with URL Decoding

```javascript
const { IntegratedGoogleNewsSearcher } = require('./news-searcher');

const searcher = new IntegratedGoogleNewsSearcher();

// Search with URL decoding enabled (default)
const results = await searcher.searchNews('Bitcoin price', 'en', 'US', 10, true);

if (results.success) {
    console.log(`Found ${results.totalResults} articles`);
    console.log(`Decoded ${results.decodingStats.successful}/${results.decodingStats.total} URLs`);
    
    results.articles.forEach(article => {
        console.log(`${article.title}`);
        console.log(`Source: ${article.source} → ${article.domain}`);
        console.log(`Real URL: ${article.realUrl || 'Not decoded'}`);
        console.log('---');
    });
}
```

### Fast Search without URL Decoding

```javascript
// For faster searches when real URLs aren't needed
const results = await searcher.searchNews('AI technology', 'en', 'US', 15, false);

if (results.success) {
    results.articles.forEach(article => {
        console.log(`${article.title} - ${article.domain}`);
    });
}
```

### Search with Screenshot Capture

```javascript
const { IntegratedGoogleNewsSearcher } = require('./news-searcher');

const searcher = new IntegratedGoogleNewsSearcher();

// Search with URL decoding AND screenshot capture
const results = await searcher.searchNews(
    'Tesla stock', 
    'en', 'US', 
    5, 
    true,  // Enable URL decoding
    true,  // Enable screenshot capture
    {
        blockAds: false,           // Allow ads
        blockCookieBanners: false, // Allow cookie banners
        blockPopups: true,         // Block popups
        format: 'jpeg',
        viewport_width: 1920,
        viewport_height: 1080
    }
);

if (results.success) {
    results.articles.forEach(article => {
        console.log(`${article.title}`);
        console.log(`Source: ${article.source}`);
        console.log(`URL: ${article.realUrl}`);
        
        if (article.screenshot && article.screenshot.success) {
            console.log(`Screenshot: ${article.screenshot.fileName}`);
        }
    });
}
```

### Using the Standalone URL Decoder

```javascript
const { GoogleNewsDecoder } = require('./news-searcher');

const decoder = new GoogleNewsDecoder();
const googleNewsUrl = "https://news.google.com/articles/CBMi...";

const result = await decoder.decodeGoogleNewsUrl(googleNewsUrl);
if (result.status) {
    console.log(`Real URL: ${result.decoded_url}`);
} else {
    console.log(`Decode failed: ${result.message}`);
}
```

### Using the Screenshot Service Directly

```javascript
const ScreenshotService = require('./screenshot-service');

const screenshotService = new ScreenshotService();

// Capture a single screenshot
const result = await screenshotService.captureScreenshot(
    'https://example.com',
    'article-id',
    {
        format: 'png',
        viewport_width: 1280,
        viewport_height: 720,
        blockAds: true,
        blockCookieBanners: true,
        blockPopups: true
    }
);

if (result.success) {
    console.log(`Screenshot saved: ${result.fileName}`);
}
```

## Performance Benchmarks

**URL Decoding Performance:**
- **Parallel Processing**: 74% faster than sequential approach
- **Typical Performance**: ~9.2 seconds for 20 URL decodes (vs ~36 seconds sequential)
- **Success Rate**: 100% when Google's decoding API is responsive
- **Batch Processing**: 3-5 URLs processed simultaneously
- **Memory Efficient**: Only processes required articles + small buffer

**Screenshot Capture Performance:**
- **High-Performance API**: ScreenshotAPI.net with global CDN delivery
- **Batch Processing**: 5-10 screenshots captured simultaneously
- **Smart Rate Limiting**: Automatic throttling to respect API limits
- **Retry Logic**: Automatic retry on failures with exponential backoff
- **Format Support**: JPEG, PNG, WebP with optimized compression
- **Average Capture Time**: ~2-3 seconds per screenshot including processing

**Search Parameters:**
- `keyword`: Search term (string)
- `language`: Language code (default: 'en')
- `country`: Country code (default: 'US') 
- `maxResults`: Number of articles to return (default: 50)
- `decodeUrls`: Enable URL decoding (default: true)
- `captureScreenshots`: Enable screenshot capture (default: false)
- `screenshotOptions`: Screenshot configuration object

## Development Status

**✅ Production Ready Features:**
1. ✅ Advanced Google News RSS integration
2. ✅ High-performance parallel URL decoding
3. ✅ Intelligent domain extraction with multiple fallback strategies
4. ✅ Comprehensive deduplication system
5. ✅ Detailed performance monitoring and statistics
6. ✅ Robust error handling with graceful fallbacks
7. ✅ Optimized resource usage and rate limiting
8. ✅ Automated screenshot capture with content blocking
9. ✅ ScreenshotAPI.net integration with batch processing
10. ✅ Configurable screenshot options and file management
11. ✅ Comprehensive test suite with real-world examples

**🚀 Recent Major Updates:**
- **NEW**: Integrated ScreenshotAPI.net for automated screenshot capture
- **NEW**: Added configurable content blocking (ads, cookies, popups)
- **NEW**: Implemented batch screenshot processing with rate limiting
- **NEW**: Added comprehensive screenshot file management and cleanup
- **UPDATED**: Migrated from ScreenshotOne to ScreenshotAPI.net for better performance
- **IMPROVED**: Enhanced error handling for screenshot capture failures
- Implemented parallel URL decoding (74% performance improvement)
- Added intelligent domain extraction with 50+ source mappings
- Enhanced error handling with meaningful fallbacks
- Optimized resource usage to only decode required articles
- Added performance monitoring and detailed statistics

## Testing

Run the comprehensive test suite:

```bash
node test.js
```

**The test suite demonstrates:**
- **Parallel URL Decoding**: Performance comparison between old and new approaches
- **Real URL Extraction**: Converting Google News URLs to actual source URLs
- **Domain Intelligence**: Accurate domain extraction and mapping
- **Screenshot Capture**: Automated screenshot generation with content blocking
- **Multiple Search Topics**: Bitcoin, AI technology, Tesla stock, and more
- **Performance Monitoring**: Detailed timing and success rate statistics
- **Deduplication**: Advanced duplicate removal algorithms
- **Error Handling**: Graceful fallbacks when URL decoding fails
- **Content Blocking**: Configurable ad, cookie, and popup blocking
- **Batch Processing**: Efficient parallel processing of screenshots and URLs

**Sample Test Output:**
```
🚀 Testing Integrated Google News Searcher with URL Decoding
📊 Attempting to decode 20 URLs...
🚀 Starting parallel decoding of 20 URLs in batches of 5...
📦 Processing batch 1: URLs 1-5
   ✅ Success: wsj.com (1604ms)
   ✅ Success: theguardian.com (1922ms)
🎯 All 20 URLs processed in 9213ms (avg: 461ms per URL)
📊 URL Decoding Stats: 20/20 successful (100% success rate)

📸 Screenshot Capture Results:
   ✅ Screenshot: 1751872694924_article-1.jpeg (2.3s)
   ✅ Screenshot: 1751872697234_article-2.jpeg (1.8s)
   📊 Screenshot Stats: 5/5 successful (100% success rate)
```

## Environment Configuration

Create a `.env` file in your project root with the following variables:

```bash
# ScreenshotAPI.net Configuration
API_KEY_SCREENSHOTAPI=your-screenshotapi-key-here

# Optional: Google OCR API (for future text extraction features)
GOOGLE_OCR_API_KEY=your-google-ocr-key-here
```

### Getting API Keys

1. **ScreenshotAPI.net**: Sign up at [screenshotapi.net](https://screenshotapi.net) to get your API key
2. **Google OCR API**: Visit [Google Cloud Console](https://console.cloud.google.com) to set up OCR API (optional)

## License

ISC License
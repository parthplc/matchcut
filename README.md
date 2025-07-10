# MatchCut

An advanced Google News searcher with integrated URL decoding, high-performance parallel processing, automated screenshot capture, and OCR text extraction. MatchCut fetches news articles from Google News RSS feeds, decodes obfuscated URLs to reveal real source URLs, captures screenshots of article pages for visual content analysis, and extracts text from those screenshots.

## Current Status

This application is **production-ready** with advanced features and optimized performance.

## Features

### ✅ Core Features
- **Google News RSS Integration**: Fetches news articles from Google News RSS feeds.
- **Keyword Search**: Search for news articles by keyword with language and country filters.
- **Article Processing**: Extracts and processes article data including:
  - Title cleaning and normalization.
  - Publication date parsing.
  - Source name extraction.
  - Advanced domain detection and mapping.

### 🚀 Advanced URL Decoding
- **Google News URL Decoder**: Built-in decoder that converts obfuscated Google News URLs to real source URLs.
- **High Success Rate**: Achieves 100% success rate for URL decoding when Google's API is responsive.
- **Intelligent Fallbacks**: Multiple domain extraction strategies when decoding fails:
  - URL pattern analysis from Google News links.
  - Expanded source name mapping (50+ news sources).
  - Smart domain generation from source names.
  - Meaningful fallback identifiers instead of "undefined".

### ⚡ Performance Optimizations
- **Parallel URL Decoding**: Processes multiple URLs simultaneously using batch processing.
- **74% Faster**: Reduced processing time from ~36s to ~9s for typical requests.
- **Smart Rate Limiting**: Controlled concurrency with adaptive delays to respect server limits.
- **Efficient Resource Usage**: Only decodes required articles + small buffer for deduplication.

### 🔍 Smart Article Processing
- **Advanced Deduplication**: Removes duplicate articles based on:
  - Exact URL duplicates.
  - Similar title matching.
  - Content similarity detection.
- **Domain Intelligence**: Accurate domain extraction using:
  - Source name mapping for 50+ major news sources.
  - Google News URL pattern analysis.
  - Intelligent fallback domain generation.
- **Flexible Output**: Detailed article information with real URLs and source attribution.

### 📸 Advanced Screenshot Capture
- **Automated Screenshot Generation**: Captures screenshots of article pages automatically.
- **ScreenshotAPI.net Integration**: Uses high-performance screenshot API for reliable captures.
- **Intelligent Content Blocking**: Configurable blocking of:
  - Advertisements and promotional content.
  - Cookie banners and GDPR notices.
  - Popup dialogs and overlays.
- **Flexible Format Support**: JPEG, PNG, WebP with customizable quality.
- **Viewport Control**: Configurable screen dimensions and device scaling.
- **Batch Processing**: Efficient parallel screenshot capture with rate limiting.
- **Local Storage**: Automatic file management and cleanup of captured screenshots
- **Organized Storage**: Screenshots saved to `screenshots/raw/` directory.

### 🔍 OCR Text Extraction
- **Google Cloud Vision API Integration**: Extracts text from captured screenshots.
- **Automatic Text Detection**: Converts images to structured text data.
- **Confidence Scoring**: Provides accuracy metrics for extracted text.
- **Batch Processing**: Processes multiple screenshots simultaneously.
- **Structured Output**: Saves extracted text as JSON with bounding boxes and metadata.
- **Directory Management**: Organized storage for processed images and text data
- **Pretty-Printed JSON**: OCR results saved as formatted JSON files for easy reading.

### 🔧 Technical Implementation
- **Node.js** with CommonJS modules.
- **axios** for HTTP requests and URL decoding.
- **xml2js** for RSS feed parsing.
- **cheerio** for HTML parsing during URL decoding.
- **fs-extra** for advanced file system operations.
- **ScreenshotAPI.net** for reliable screenshot capture.
- **Google Cloud Vision API** for OCR text extraction.
- **Parallel Processing**: `Promise.all()` for concurrent URL decoding and screenshot capture.
- **Batch Processing**: Controlled concurrency with configurable batch sizes.
- **Comprehensive Error Handling**: Graceful fallbacks and detailed logging.
- **Configurable Parameters**: Language, country, max results, decoding options, screenshot settings.

## Project Structure

```
matchcut/
├── package.json                        # Project dependencies and configuration
├── news-searcher.js                    # Main IntegratedGoogleNewsSearcher class with URL decoder
├── screenshot-service.js               # ScreenshotAPI.net integration for automated screenshots
├── ocr-service.js                      # Google Cloud Vision API integration for OCR
├── test.js                             # Comprehensive test suite for news-searcher and screenshot-service
├── test-ocr.js                         # Test suite for the OCR service
├── decoder.js                          # Standalone URL decoder (legacy, for reference)
├── main.py                             # Placeholder for future Python-based functionality
├── pyproject.toml                      # Python project configuration (for future use)
├── GEMINI.md                           # Additional documentation (Gemini-related)
├── matchcut-ocr-app-serviceaccount.json # Google Cloud service account credentials
├── screenshots/                        # Directory for captured screenshots
│   ├── raw/                            # Raw screenshot files (JPEG/PNG)
│   ├── processed/                      # Processed screenshots (e.g., after OCR)
│   ├── logs/                           # OCR output in pretty-printed JSON format
│   └── temp/                           # Temporary files during processing
├── oldscreenshots/                     # Archived screenshots from previous runs
├── .env                                # Environment variables (API keys)
├── node_modules/                       # Dependencies
└── README.md                           # This file
```

**Note on `decoder.js`**: This file represents the original, standalone URL decoder. The logic has since been integrated into `news-searcher.js` for better performance and a more streamlined workflow. It is kept for reference and for testing the decoding logic in isolation.

## Python Environment

This project includes a basic setup for future Python integration, indicated by the presence of `main.py`, `pyproject.toml`, and a `.venv` directory. This is intended for future development of Python-based services, such as data analysis or machine learning tasks on the collected news data.

## Dependencies

- **@google-cloud/vision**: Google Cloud Vision API client for OCR.
- **axios**: HTTP client for API requests and URL decoding.
- **xml2js**: XML/RSS parsing.
- **cheerio**: HTML parsing for URL decoding.
- **fs-extra**: Enhanced file system operations.
- **dotenv**: Environment variable management.
- **sharp**: Image processing and optimization.

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

### Using the OCR Service

```javascript
const OCRService = require('./ocr-service');
const path = require('path');

const ocrService = new OCRService();
const imagePath = path.join(__dirname, 'screenshots', 'your-screenshot.jpeg');

const ocrResult = await ocrService.processScreenshot(imagePath);

if (ocrResult.success) {
    console.log('Full Text:', ocrResult.fullText);
    console.log('Text Blocks:', ocrResult.textBlocks.length);
}
```

## Testing

This project includes two main test suites to ensure the reliability of its core features.

### Main Test Suite (`test.js`)

Run the comprehensive test suite for the news searcher and screenshot service:

```bash
node test.js
```

**The `test.js` suite demonstrates:**
- **Parallel URL Decoding**: Performance comparison between old and new approaches.
- **Real URL Extraction**: Converting Google News URLs to actual source URLs.
- **Domain Intelligence**: Accurate domain extraction and mapping.
- **Screenshot Capture**: Automated screenshot generation with content blocking.
- **Multiple Search Topics**: Bitcoin, AI technology, Tesla stock, and more.
- **Performance Monitoring**: Detailed timing and success rate statistics.
- **Deduplication**: Advanced duplicate removal algorithms.
- **Error Handling**: Graceful fallbacks when URL decoding fails.
- **Content Blocking**: Configurable ad, cookie, and popup blocking.
- **Batch Processing**: Efficient parallel processing of screenshots and URLs.

### OCR Test Suite (`test-ocr.js`)

Run the test suite for the OCR service:

```bash
node test-ocr.js
```

**The `test-ocr.js` suite demonstrates:**
- **Google Cloud Vision API Connection**: Verifies that the API key is correctly configured.
- **Single Image OCR**: Processes a single screenshot and displays detailed results.
- **Batch OCR**: Processes multiple screenshots to test batch functionality.
- **Text Preprocessing**: Shows cleaned text, word counts, and other statistics.
- **Searchable Index**: Demonstrates the creation of a searchable index from the OCR data.

## Environment Configuration

Create a `.env` file in your project root with the following variables:

```bash
# ScreenshotAPI.net Configuration
API_KEY_SCREENSHOTAPI=your-screenshotapi-key-here

# Google Cloud Vision API (for OCR)
# Path to your Google Cloud service account JSON file
GOOGLE_APPLICATION_CREDENTIALS=./matchcut-ocr-app-serviceaccount.json
```

### Getting API Keys

1.  **ScreenshotAPI.net**: Sign up at [screenshotapi.net](https://screenshotapi.net) to get your API key.
2.  **Google Cloud Vision API**: Create a service account in the [Google Cloud Console](https://console.cloud.google.com), enable the Cloud Vision API, and download the service account key file (JSON).

**Security Note**: The `matchcut-ocr-app-serviceaccount.json` file contains sensitive credentials. **Do not commit this file to version control.** Ensure it is listed in your `.gitignore` file.

## License

ISC License

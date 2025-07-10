require('dotenv').config();
const OCRService = require('./ocr-service');
const path = require('path');
const fs = require('fs-extra');

async function testOCRService() {
    console.log('🚀 Starting OCR Service Test');
    console.log('=' .repeat(50));
    
    const ocrService = new OCRService();
    
    // Test API connection
    console.log('\n1. Testing Google Cloud Vision API connection...');
    const connectionTest = await ocrService.testConnection();
    
    if (!connectionTest) {
        console.log('❌ API connection failed. Please check your GOOGLE_OCR_API_KEY in .env file');
        return;
    }
    
    // Get available screenshots
    const screenshotsDir = path.join(__dirname, 'screenshots');
    const files = await fs.readdir(screenshotsDir);
    const imageFiles = files.filter(f => f.match(/\.(jpg|jpeg|png)$/i));
    
    if (imageFiles.length === 0) {
        console.log('⚠️  No screenshot images found to test OCR');
        return;
    }
    
    console.log(`\n2. Found ${imageFiles.length} screenshot images for testing`);
    
    // Test single image processing
    const testImage = path.join(screenshotsDir, imageFiles[0]);
    console.log(`\n3. Testing single image OCR: ${imageFiles[0]}`);
    
    const result = await ocrService.processScreenshot(testImage);
    
    if (result.success) {
        console.log('✅ OCR Processing successful!');
        console.log(`📊 Results Summary:`);
        console.log(`   - Total text blocks: ${result.textBlocks.length}`);
        console.log(`   - Average confidence: ${result.averageConfidence.toFixed(2)}%`);
        console.log(`   - Image dimensions: ${result.imageSize.width}x${result.imageSize.height}`);
        console.log(`   - Full text length: ${result.fullText.length} characters`);
        console.log(`   - JSON saved to: ${result.jsonPath}`);
        
        // Show text statistics
        if (result.preprocessedText && result.preprocessedText.statistics) {
            const stats = result.preprocessedText.statistics;
            console.log(`\n📈 Text Statistics:`);
            console.log(`   - Total words: ${stats.totalWords}`);
            console.log(`   - Total characters: ${stats.totalCharacters}`);
            console.log(`   - Average font size: ${stats.averageFontSize.toFixed(1)}px`);
            console.log(`   - Font size distribution:`, stats.fontSizeDistribution);
        }
        
        // Show some sample text blocks
        console.log(`\n📝 Sample Text Blocks (first 5):`);
        result.textBlocks.slice(0, 5).forEach((block, index) => {
            console.log(`   ${index + 1}. "${block.text}" (${block.fontSize}px, ${(block.confidence * 100).toFixed(1)}% confidence)`);
            console.log(`      Position: (${block.boundingBox.x}, ${block.boundingBox.y}) ${block.boundingBox.width}x${block.boundingBox.height}`);
        });
        
        // Show searchable index sample
        if (result.preprocessedText && result.preprocessedText.searchableIndex) {
            const indexKeys = Object.keys(result.preprocessedText.searchableIndex);
            console.log(`\n🔍 Searchable Index Sample (first 10 words):`);
            indexKeys.slice(0, 10).forEach(word => {
                const occurrences = result.preprocessedText.searchableIndex[word];
                console.log(`   - "${word}": ${occurrences.length} occurrence(s)`);
            });
        }
        
        // Show cleaned text sample
        if (result.preprocessedText && result.preprocessedText.cleanedFullText) {
            const cleanedText = result.preprocessedText.cleanedFullText;
            console.log(`\n🧹 Cleaned Text Sample (first 200 characters):`);
            console.log(`   "${cleanedText.substring(0, 200)}..."`);
        }
        
    } else {
        console.log('❌ OCR Processing failed:', result.error);
    }
    
    // Test batch processing if we have multiple images
    if (imageFiles.length > 1) {
        console.log(`\n4. Testing batch OCR processing with ${Math.min(3, imageFiles.length)} images...`);
        
        const testImages = imageFiles.slice(0, 3).map(f => path.join(screenshotsDir, f));
        const batchResults = await ocrService.batchProcessScreenshots(testImages);
        
        console.log(`\n📊 Batch Processing Results:`);
        batchResults.forEach((result, index) => {
            const filename = path.basename(testImages[index]);
            if (result.success) {
                console.log(`   ✅ ${filename}: ${result.textBlocks.length} text blocks, ${result.averageConfidence.toFixed(1)}% confidence`);
            } else {
                console.log(`   ❌ ${filename}: ${result.error}`);
            }
        });
    }
    
    console.log('\n' + '=' .repeat(50));
    console.log('🎉 OCR Service Test Complete!');
}

// Run the test
testOCRService().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
});
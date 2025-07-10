require('dotenv').config();
const vision = require('@google-cloud/vision');
const fs = require('fs-extra');
const path = require('path');

class OCRService {
    constructor() {
        // Initialize the Google Cloud Vision API client with service account
        this.client = new vision.ImageAnnotatorClient({
            keyFilename: path.join(__dirname, 'matchcut-ocr-app-serviceaccount.json')
        });
        
        this.processedDir = path.join(__dirname, 'screenshots', 'processed');
        this.textDataDir = path.join(__dirname, 'screenshots', 'logs');
        
        // Ensure directories exist
        fs.ensureDirSync(this.processedDir);
        fs.ensureDirSync(this.textDataDir);
        
        console.log('🔍 OCR Service initialized with Google Cloud Vision API');
    }

    /**
     * Extract text from image using Google Cloud Vision API
     * @param {string} imagePath - Path to the image file
     * @returns {Promise<Object>} OCR results with text, bounding boxes, and confidence scores
     */
    async extractTextFromImage(imagePath) {
        try {
            console.log(`📖 Starting OCR extraction for: ${path.basename(imagePath)}`);
            
            // Perform text detection
            const [result] = await this.client.textDetection(imagePath);
            const detections = result.textAnnotations;
            
            if (!detections || detections.length === 0) {
                console.log('⚠️  No text detected in image');
                return {
                    success: false,
                    error: 'No text detected',
                    textBlocks: [],
                    fullText: '',
                    confidence: 0
                };
            }

            // First annotation contains the full text
            const fullTextAnnotation = detections[0];
            const fullText = fullTextAnnotation.description;
            
            // Extract individual text blocks with detailed information
            const textBlocks = [];
            
            // Skip the first annotation (full text) and process individual words/blocks
            for (let i = 1; i < detections.length; i++) {
                const detection = detections[i];
                const vertices = detection.boundingPoly.vertices;
                
                // Calculate bounding box dimensions
                const boundingBox = this.calculateBoundingBox(vertices);
                
                // Estimate font size based on bounding box height
                const estimatedFontSize = this.estimateFontSize(boundingBox);
                
                textBlocks.push({
                    text: detection.description,
                    boundingBox: boundingBox,
                    confidence: detection.confidence || 0.95, // Default confidence if not provided
                    fontSize: estimatedFontSize,
                    vertices: vertices,
                    locale: detection.locale || 'en'
                });
            }
            
            // Get additional text properties using document text detection
            const [documentResult] = await this.client.documentTextDetection(imagePath);
            const documentText = documentResult.fullTextAnnotation;
            
            let enhancedTextBlocks = textBlocks;
            
            if (documentText && documentText.pages && documentText.pages.length > 0) {
                enhancedTextBlocks = this.enhanceTextBlocks(textBlocks, documentText);
            }
            
            const ocrResult = {
                success: true,
                imagePath: imagePath,
                fullText: fullText,
                textBlocks: enhancedTextBlocks,
                totalBlocks: enhancedTextBlocks.length,
                averageConfidence: this.calculateAverageConfidence(enhancedTextBlocks),
                timestamp: Date.now(),
                imageSize: await this.getImageDimensions(imagePath)
            };
            
            console.log(`✅ OCR completed: ${enhancedTextBlocks.length} text blocks extracted`);
            console.log(`📊 Average confidence: ${ocrResult.averageConfidence.toFixed(2)}%`);
            
            return ocrResult;
            
        } catch (error) {
            console.error(`❌ OCR extraction failed: ${error.message}`);
            return {
                success: false,
                error: error.message,
                imagePath: imagePath,
                textBlocks: [],
                fullText: '',
                confidence: 0,
                timestamp: Date.now()
            };
        }
    }

    /**
     * Calculate bounding box from vertices
     * @param {Array} vertices - Array of vertex objects with x, y coordinates
     * @returns {Object} Bounding box with x, y, width, height
     */
    calculateBoundingBox(vertices) {
        if (!vertices || vertices.length === 0) {
            return { x: 0, y: 0, width: 0, height: 0 };
        }
        
        const xs = vertices.map(v => v.x || 0);
        const ys = vertices.map(v => v.y || 0);
        
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        
        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    /**
     * Estimate font size based on bounding box height
     * @param {Object} boundingBox - Bounding box with dimensions
     * @returns {number} Estimated font size in pixels
     */
    estimateFontSize(boundingBox) {
        // Font size is typically 70-80% of the bounding box height
        // This is a rough estimation, actual font size detection would require more complex analysis
        return Math.round(boundingBox.height * 0.75);
    }

    /**
     * Enhance text blocks with additional information from document text detection
     * @param {Array} textBlocks - Original text blocks
     * @param {Object} documentText - Document text annotation result
     * @returns {Array} Enhanced text blocks
     */
    enhanceTextBlocks(textBlocks, documentText) {
        const enhanced = [...textBlocks];
        
        // Add paragraph and line information if available
        if (documentText.pages && documentText.pages[0] && documentText.pages[0].blocks) {
            const blocks = documentText.pages[0].blocks;
            
            blocks.forEach((block, blockIndex) => {
                if (block.paragraphs) {
                    block.paragraphs.forEach((paragraph, paragraphIndex) => {
                        if (paragraph.words) {
                            paragraph.words.forEach((word, wordIndex) => {
                                // Find corresponding text block and enhance it
                                const wordText = word.symbols ? word.symbols.map(s => s.text).join('') : '';
                                const matchingBlock = enhanced.find(tb => tb.text === wordText);
                                
                                if (matchingBlock) {
                                    matchingBlock.blockIndex = blockIndex;
                                    matchingBlock.paragraphIndex = paragraphIndex;
                                    matchingBlock.wordIndex = wordIndex;
                                    matchingBlock.isLineBreak = word.property && word.property.detectedBreak;
                                }
                            });
                        }
                    });
                }
            });
        }
        
        return enhanced;
    }

    /**
     * Calculate average confidence across all text blocks
     * @param {Array} textBlocks - Array of text blocks
     * @returns {number} Average confidence percentage
     */
    calculateAverageConfidence(textBlocks) {
        if (!textBlocks || textBlocks.length === 0) return 0;
        
        const totalConfidence = textBlocks.reduce((sum, block) => sum + (block.confidence || 0), 0);
        return (totalConfidence / textBlocks.length) * 100;
    }

    /**
     * Get image dimensions
     * @param {string} imagePath - Path to the image file
     * @returns {Promise<Object>} Image dimensions
     */
    async getImageDimensions(imagePath) {
        try {
            const sharp = require('sharp');
            const metadata = await sharp(imagePath).metadata();
            return {
                width: metadata.width,
                height: metadata.height
            };
        } catch (error) {
            console.warn(`Could not get image dimensions: ${error.message}`);
            return { width: 0, height: 0 };
        }
    }

    /**
     * Save OCR results to JSON file
     * @param {Object} ocrResult - OCR extraction result
     * @param {string} originalImagePath - Original image path
     * @returns {Promise<string>} Path to saved JSON file
     */
    async saveOCRResult(ocrResult, originalImagePath) {
        try {
            const basename = path.basename(originalImagePath, path.extname(originalImagePath));
            const jsonPath = path.join(this.textDataDir, `${basename}_ocr.json`);
            
            // Write pretty-printed JSON with 2-space indentation
            await fs.writeJSON(jsonPath, ocrResult, { spaces: 2 });
            
            console.log(`💾 OCR results saved to: ${jsonPath}`);
            return jsonPath;
        } catch (error) {
            console.error(`Failed to save OCR results: ${error.message}`);
            throw error;
        }
    }

    /**
     * Process a single screenshot image
     * @param {string} imagePath - Path to the image file
     * @returns {Promise<Object>} Complete OCR processing result
     */
    async processScreenshot(imagePath) {
        try {
            // Extract text from image
            const ocrResult = await this.extractTextFromImage(imagePath);
            
            if (!ocrResult.success) {
                return ocrResult;
            }
            
            // Save OCR results
            const jsonPath = await this.saveOCRResult(ocrResult, imagePath);
            
            // Add preprocessing
            const preprocessedResult = await this.preprocessText(ocrResult);
            
            return {
                ...preprocessedResult,
                jsonPath: jsonPath
            };
            
        } catch (error) {
            console.error(`Failed to process screenshot: ${error.message}`);
            return {
                success: false,
                error: error.message,
                imagePath: imagePath,
                timestamp: Date.now()
            };
        }
    }

    /**
     * Preprocess extracted text
     * @param {Object} ocrResult - OCR extraction result
     * @returns {Promise<Object>} Preprocessed result
     */
    async preprocessText(ocrResult) {
        const preprocessed = {
            ...ocrResult,
            preprocessedText: {
                cleanedFullText: this.cleanText(ocrResult.fullText),
                textBlocks: ocrResult.textBlocks.map(block => ({
                    ...block,
                    cleanedText: this.cleanText(block.text),
                    wordCount: this.countWords(block.text)
                })),
                searchableIndex: this.createSearchableIndex(ocrResult.textBlocks),
                statistics: this.calculateTextStatistics(ocrResult.textBlocks)
            }
        };
        
        return preprocessed;
    }

    /**
     * Clean and normalize text
     * @param {string} text - Raw text to clean
     * @returns {string} Cleaned text
     */
    cleanText(text) {
        if (!text) return '';
        
        return text
            .replace(/\s+/g, ' ')           // Replace multiple whitespace with single space
            .replace(/[^\w\s\.\,\!\?\-\:\;\"\']/g, '') // Remove special characters except basic punctuation
            .trim();                        // Remove leading/trailing whitespace
    }

    /**
     * Count words in text
     * @param {string} text - Text to count words in
     * @returns {number} Word count
     */
    countWords(text) {
        if (!text) return 0;
        return text.trim().split(/\s+/).length;
    }

    /**
     * Create searchable index from text blocks
     * @param {Array} textBlocks - Array of text blocks
     * @returns {Object} Searchable index
     */
    createSearchableIndex(textBlocks) {
        const index = {};
        
        textBlocks.forEach((block, blockIndex) => {
            const words = block.text.toLowerCase().split(/\s+/);
            
            words.forEach((word, wordIndex) => {
                const cleanWord = word.replace(/[^\w]/g, '');
                if (cleanWord.length > 0) {
                    if (!index[cleanWord]) {
                        index[cleanWord] = [];
                    }
                    
                    index[cleanWord].push({
                        blockIndex: blockIndex,
                        wordIndex: wordIndex,
                        position: block.boundingBox,
                        confidence: block.confidence,
                        fontSize: block.fontSize
                    });
                }
            });
        });
        
        return index;
    }

    /**
     * Calculate text statistics
     * @param {Array} textBlocks - Array of text blocks
     * @returns {Object} Text statistics
     */
    calculateTextStatistics(textBlocks) {
        if (!textBlocks || textBlocks.length === 0) {
            return {
                totalWords: 0,
                totalCharacters: 0,
                averageFontSize: 0,
                fontSizeDistribution: {}
            };
        }
        
        const stats = {
            totalWords: 0,
            totalCharacters: 0,
            averageFontSize: 0,
            fontSizeDistribution: {}
        };
        
        let totalFontSize = 0;
        
        textBlocks.forEach(block => {
            stats.totalWords += this.countWords(block.text);
            stats.totalCharacters += block.text.length;
            totalFontSize += block.fontSize || 0;
            
            const fontSize = Math.round(block.fontSize || 0);
            stats.fontSizeDistribution[fontSize] = (stats.fontSizeDistribution[fontSize] || 0) + 1;
        });
        
        stats.averageFontSize = totalFontSize / textBlocks.length;
        
        return stats;
    }

    /**
     * Batch process multiple screenshots
     * @param {Array} imagePaths - Array of image paths to process
     * @returns {Promise<Array>} Array of processing results
     */
    async batchProcessScreenshots(imagePaths) {
        console.log(`🔄 Starting batch OCR processing for ${imagePaths.length} images`);
        
        const results = [];
        
        for (const imagePath of imagePaths) {
            console.log(`Processing: ${path.basename(imagePath)}`);
            const result = await this.processScreenshot(imagePath);
            results.push(result);
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        
        console.log(`📊 Batch OCR completed: ${successful} successful, ${failed} failed`);
        
        return results;
    }

    /**
     * Test OCR service connection
     * @returns {Promise<boolean>} Connection test result
     */
    async testConnection() {
        try {
            console.log('🧪 Testing Google Cloud Vision API connection...');
            
            // Create a simple test image or use an existing one
            const testImagePath = path.join(__dirname, 'screenshots', 'raw');
            const files = await fs.readdir(testImagePath);
            const imageFiles = files.filter(f => f.match(/\.(jpg|jpeg|png)$/i));
            
            if (imageFiles.length === 0) {
                console.log('⚠️  No test images found for connection test');
                return false;
            }
            
            const testPath = path.join(testImagePath, imageFiles[0]);
            const result = await this.extractTextFromImage(testPath);
            
            if (result.success) {
                console.log('✅ Google Cloud Vision API connection successful');
                return true;
            } else {
                console.log('❌ Google Cloud Vision API connection failed');
                return false;
            }
            
        } catch (error) {
            console.log(`❌ Google Cloud Vision API connection failed: ${error.message}`);
            return false;
        }
    }
}

module.exports = OCRService;
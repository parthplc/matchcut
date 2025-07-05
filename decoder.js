/**
 * Google News URL Decoder
 *
 * This script decodes a Google News URL to its original source URL.
 * It replicates the logic from the provided Python script.
 *
 * Dependencies:
 * - axios: For making HTTP requests.
 * - cheerio: For parsing HTML and extracting data.
 *
 * To Run:
 * 1. Make sure you have Node.js installed.
 * 2. Save this file as `decoder.js`.
 * 3. In your terminal, install the dependencies:
 * npm install axios cheerio
 * 4. Run the script:
 * node decoder.js
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');

class GoogleNewsDecoder {
    /**
     * Initialize the GoogleNewsDecoder class.
     * @param {string} [proxy] - Optional proxy to be used for all requests.
     * Format: http://user:pass@host:port
     */
    constructor(proxy) {
        let proxyConfig = null;
        if (proxy) {
            try {
                const proxyUrl = new URL(proxy);
                proxyConfig = {
                    protocol: proxyUrl.protocol.replace(':', ''),
                    host: proxyUrl.hostname,
                    port: proxyUrl.port,
                };
                if (proxyUrl.username || proxyUrl.password) {
                    proxyConfig.auth = {
                        username: proxyUrl.username,
                        password: proxyUrl.password,
                    };
                }
            } catch (error) {
                console.error("Invalid proxy URL format. Ignoring proxy.", error);
            }
        }
        this.client = axios.create({
            proxy: proxyConfig,
            // Follow redirects automatically
            maxRedirects: 5,
        });
    }

    /**
     * Extracts the base64-like string from a Google News URL.
     * @param {string} sourceUrl - The Google News article URL.
     * @returns {object} An object containing 'status' and 'base64Str' if successful,
     * otherwise 'status' and 'message'.
     */
    getBase64Str(sourceUrl) {
        try {
            const url = new URL(sourceUrl);
            const pathParts = url.pathname.split('/');
            
            if (url.hostname === 'news.google.com' && pathParts.length > 1 && ['articles', 'read'].includes(pathParts[pathParts.length - 2])) {
                return { status: true, base64Str: pathParts[pathParts.length - 1] };
            }
            return { status: false, message: 'Invalid Google News URL format.' };
        } catch (e) {
            return { status: false, message: `Error in getBase64Str: ${e.message}` };
        }
    }

    /**
     * Fetches signature and timestamp required for decoding from Google News.
     * It tries the 'articles' URL format first and falls back to the 'rss/articles' format.
     * @param {string} base64Str - The base64 string from the Google News URL.
     * @returns {Promise<object>} A promise that resolves to an object containing decoding parameters.
     */
    async getDecodingParams(base64Str) {
        const urlsToTry = [
            `https://news.google.com/articles/${base64Str}`,
            `https://news.google.com/rss/articles/${base64Str}`
        ];

        for (const url of urlsToTry) {
            try {
                const response = await this.client.get(url);
                const $ = cheerio.load(response.data);
                const dataElement = $('c-wiz > div[jscontroller]');

                if (dataElement.length > 0) {
                    const signature = dataElement.attr('data-n-a-sg');
                    const timestamp = dataElement.attr('data-n-a-ts');
                    if (signature && timestamp) {
                        return {
                            status: true,
                            signature,
                            timestamp,
                            base64Str,
                        };
                    }
                }
            } catch (error) {
                // Ignore error and try the next URL
                console.warn(`Failed to fetch from ${url}. Trying next URL. Error: ${error.message}`);
            }
        }

        return {
            status: false,
            message: 'Failed to fetch data attributes from Google News from all attempted URLs.',
        };
    }

    /**
     * Decodes the Google News URL using the signature and timestamp.
     * @param {string} signature - The signature required for decoding.
     * @param {string} timestamp - The timestamp required for decoding.
     * @param {string} base64Str - The base64 string from the Google News URL.
     * @returns {Promise<object>} A promise that resolves to the decoded URL.
     */
    async decodeUrl(signature, timestamp, base64Str) {
        const url = 'https://news.google.com/_/DotsSplashUi/data/batchexecute';
        
        // This complex payload structure is reverse-engineered from the web client.
        const innerPayload = JSON.stringify([
            "garturlreq",
            [
                ["X", "X", ["X", "X"], null, null, 1, 1, "US:en", null, 1, null, null, null, null, null, 0, 1],
                "X", "X", 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0
            ],
            base64Str,
            Number(timestamp), // Timestamp must be a number
            signature
        ]);

        const outerPayload = [[["Fbv4je", innerPayload]]];
        const requestBody = `f.req=${encodeURIComponent(JSON.stringify(outerPayload))}`;

        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
        };

        try {
            const response = await this.client.post(url, requestBody, { headers });
            
            // The response is a non-standard format. It contains multiple lines
            // and the actual data is a JSON string within one of the lines.
            const responseLines = response.data.split('\n');
            const dataLine = responseLines.find(line => line.startsWith('[['));

            if (!dataLine) {
                 throw new Error("Could not find the data line in the batchexecute response.");
            }
            
            const parsedData = JSON.parse(dataLine);
            const innerJsonString = parsedData[0][2];
            const decodedUrl = JSON.parse(innerJsonString)[1];

            return { status: true, decoded_url: decodedUrl };
        } catch (e) {
            return { status: false, message: `Error in decodeUrl: ${e.message}` };
        }
    }

    /**
     * Main method to decode a Google News article URL into its original source URL.
     * @param {string} sourceUrl - The Google News article URL.
     * @returns {Promise<object>} A promise that resolves to the final result.
     */
    async decodeGoogleNewsUrl(sourceUrl) {
        try {
            // 1. Extract the base64 string from the URL
            const base64Response = this.getBase64Str(sourceUrl);
            if (!base64Response.status) {
                return base64Response;
            }

            // 2. Get the signature and timestamp needed for the API call
            const decodingParamsResponse = await this.getDecodingParams(base64Response.base64Str);
            if (!decodingParamsResponse.status) {
                return decodingParamsResponse;
            }

            // 3. Make the final API call to get the real URL
            const decodedUrlResponse = await this.decodeUrl(
                decodingParamsResponse.signature,
                decodingParamsResponse.timestamp,
                decodingParamsResponse.base64Str
            );

            return decodedUrlResponse;
        } catch (e) {
            return { status: false, message: `Error in decodeGoogleNewsUrl: ${e.message}` };
        }
    }
}


// --- Example Usage ---
// This part of the script will only run when executed directly with `node decoder.js`
async function main() {
    console.log("--- Starting Google News URL Decoding Test ---");

    // Instantiate the decoder.
    // If you have a proxy, you can pass it here, e.g., new GoogleNewsDecoder('http://user:pass@host:port')
    const decoder = new GoogleNewsDecoder();

    const urlsToTest = [
        "https://news.google.com/articles/CBMiVkFVX3lxTE4zaGU2bTY2ZGkzdTRkSkJ0cFpsTGlDUjkxU2FBRURaTWU0c3QzVWZ1MHZZNkZ5Vzk1ZVBnTDFHY2R6ZmdCUkpUTUJsS1pqQTlCRzlzbHV3?oc=5",
        "https://news.google.com/rss/articles/CBMiqwFBVV95cUxNMTRqdUZpNl9hQldXbGo2YVVLOGFQdkFLYldlMUxUVlNEaElsYjRRODVUMkF3R1RYdWxvT1NoVzdUYS0xSHg3eVdpTjdVODQ5cVJJLWt4dk9vZFBScVp2ZmpzQXZZRy1ncDM5c2tRbXBVVHVrQnpmMGVrQXNkQVItV3h4dVQ1V1BTbjhnM3k2ZUdPdnhVOFk1NmllNTZkdGJTbW9NX0k5U3E2Tkk?oc=5",
        "https://news.google.com/articles/invalid-url-for-testing" // This one should fail gracefully
    ];

    for (const url of urlsToTest) {
        console.log(`\nDecoding URL: ${url}`);
        const result = await decoder.decodeGoogleNewsUrl(url);

        if (result.status) {
            console.log("✅ Success! Decoded URL:", result.decoded_url);
        } else {
            console.error("❌ Error:", result.message);
        }
    }

    console.log("\n--- Decoding Test Finished ---");
}

// Execute the main function
main();

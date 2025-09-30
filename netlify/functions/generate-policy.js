// netlify/functions/generate-policy.js
exports.handler = async (event, context) => {
    // Handle CORS preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': 'https://www.finokapi.com',
                'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
            },
            body: ''
        };
    }
    
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: {
                'Access-Control-Allow-Origin': 'https://www.finokapi.com',
            },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
    
    // Check 1: Referrer validation (allow calls only from finokapi.com)
    const referer = event.headers.referer || event.headers.referrer || '';
    if (!referer.includes('finokapi.com')) {
        console.log('Blocked request - invalid referrer:', referer);
        return {
            statusCode: 403,
            headers: {
                'Access-Control-Allow-Origin': 'https://www.finokapi.com',
            },
            body: JSON.stringify({ error: 'Access denied' })
        };
    }
    
    // Check 2: API Key validation
    const apiKey = event.headers['x-api-key'];
    const validApiKey = process.env.API_KEY;
    
    if (!apiKey || apiKey !== validApiKey) {
        console.log('Blocked request - invalid or missing API key');
        return {
            statusCode: 401,
            headers: {
                'Access-Control-Allow-Origin': 'https://www.finokapi.com',
            },
            body: JSON.stringify({ error: 'Unauthorized' })
        };
    }
    
    try {
        const formData = JSON.parse(event.body);

        // Check 3: Verify reCAPTCHA
        const recaptchaToken = formData.recaptcha_token;
        if (recaptchaToken) {
            const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;
            const recaptchaVerify = await fetch('https://www.google.com/recaptcha/api/siteverify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `secret=${recaptchaSecret}&response=${recaptchaToken}`
            });
            
            const recaptchaResult = await recaptchaVerify.json();
            console.log('reCAPTCHA verification:', recaptchaResult);
            
            if (!recaptchaResult.success) {
                console.log('reCAPTCHA verification failed');
                return {
                    statusCode: 403,
                    headers: {
                        'Access-Control-Allow-Origin': 'https://www.finokapi.com',
                    },
                    body: JSON.stringify({ error: 'reCAPTCHA verification failed' })
                };
            }
            
            // Remove recaptcha_token before sending to n8n
            delete formData.recaptcha_token;
        }
        
        // Your n8n webhook URL (stored securely)
        const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://finokapi.app.n8n.cloud/webhook/e070409b-7313-4c3c-b670-346c0b9f53ce';
        
        console.log('Proxying request to n8n');
        
        // Forward the request to n8n
        const response = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) {
            throw new Error(`n8n webhook failed: ${response.status}`);
        }
        
        // Get response as text first for debugging
        const responseText = await response.text();
        console.log('n8n raw response:', responseText.substring(0, 500));
        
        // Try to parse as JSON
        let result;
        try {
            result = JSON.parse(responseText);
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            console.error('Response was:', responseText);
            throw new Error('Invalid JSON response from n8n');
        }
        
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': 'https://www.finokapi.com',
                'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(result)
        };
        
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': 'https://www.finokapi.com',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ error: 'Internal server error', message: error.message })
        };
    }
};

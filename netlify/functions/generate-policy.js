// netlify/functions/generate-policy.js
exports.handler = async (event, context) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
    
    try {
        const formData = JSON.parse(event.body);
        
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
        
        const result = await response.json();
        
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
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
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ error: 'Internal server error', message: error.message })
        };
    }
};

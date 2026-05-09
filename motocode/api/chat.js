export default async function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not set' });
  }

  const { prompt, image, mimeType } = req.body;
  if (!prompt || !image) {
    return res.status(400).json({ error: 'Missing prompt or image' });
  }

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType || 'image/jpeg',
                  data: image
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024,
          }
        })
      }
    );

    const data = await geminiRes.json();

    // Log for debugging
    console.log('Gemini status:', geminiRes.status);
    console.log('Gemini response:', JSON.stringify(data).substring(0, 300));

    if (!geminiRes.ok) {
      return res.status(geminiRes.status).json({ 
        error: data.error?.message || 'Gemini API error',
        details: data 
      });
    }

    // Return the full Gemini response so frontend can parse candidates
    return res.status(200).json(data);

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
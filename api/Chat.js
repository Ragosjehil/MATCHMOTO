// Gagamit tayo ng module.exports imbes na export default
module.exports = async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    
    // Kunin ang prompt at image mula sa request body
    const { prompt, image } = req.body;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ 
                    parts: [
                        { text: prompt },
                        // Kung may image na pinasa (Base64), isama natin dito
                        ...(image ? [{ inline_data: { mime_type: "image/jpeg", data: image } }] : [])
                    ] 
                }]
            })
        });

        const data = await response.json();
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch from Gemini" });
    }
};
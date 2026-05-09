
async function identifyPart(base64Image) {
    try {
        const response = await fetch('/api/chat', { // Dapat /api/chat ang path
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                prompt: "Identify this motorcycle part and describe its function.",
                image: base64Image 
            })
        });

        const data = await response.json();
        
        
        console.log("AI Result:", data);

document.getElementById('result').innerText = data.candidates[0].content.parts[0].text;

    } catch (error) {
        console.error("Error sa pag-scan:", error);
    }
}
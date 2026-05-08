async function sendToAI(userMessage) {
    const response = await fetch('/api/chat', { // Tinatawag nito ang file sa api/ folder
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMessage })
    });

    const data = await response.json();
    console.log("AI Response:", data);
    // Dito mo na ilalagay kung paano mo idi-display ang sagot sa HTML mo
}
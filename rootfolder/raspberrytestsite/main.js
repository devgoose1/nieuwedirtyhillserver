async function verstuurData() {
    // Get values from input fields
    const userId = document.getElementById("userId").value;
    const checkpointId = document.getElementById("checkpoint").value;
    const tijd = document.getElementById("tijd").value;

    // Build JSON data object
    const data = { userId, checkpointId, tijd };

    // Show sending data in log
    document.getElementById("log").textContent = "Verzenden: " + JSON.stringify(data, null, 2);

    try {
        // Send POST request to backend
        const res = await fetch("http://localhost:5000/api/checkpoint", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        // Get JSON response
        const result = await res.json();

        // Show response in log
        document.getElementById("log").textContent += "\n\nResponse: " + JSON.stringify(result, null, 2);
    } catch (err) {
        // Show error in log
        document.getElementById("log").textContent += "\n\nError: " + err;
    }
}

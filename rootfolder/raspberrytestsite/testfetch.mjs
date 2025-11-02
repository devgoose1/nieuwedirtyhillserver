// Minimal Node ESM script to simulate a full run

async function verstuurData(userId, checkpointId, tijd) {
    const data = { userId, checkpointId, tijd };

    console.log("Verzenden:", JSON.stringify(data, null, 2));

    try {
        const res = await fetch("http://localhost:5000/api/checkpoint", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        const result = await res.json();
        console.log("Response:", JSON.stringify(result, null, 2));
    } catch (err) {
        console.error("Error:", err);
    }
}

// Simulate a full run
await verstuurData("Fietser1", "start", "14:00");
await verstuurData("Fietser1", "midden", "14:15");
await verstuurData("Fietser1", "eind", "14:30");

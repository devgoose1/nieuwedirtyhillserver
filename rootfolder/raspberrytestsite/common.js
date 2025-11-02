// common.js
export async function sendCheckpoint(url, userId, checkpointId, tijd) {
    const data = { userId, checkpointId, tijd };
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return res.json();
}

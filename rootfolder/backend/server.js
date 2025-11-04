const express = require('express');
const cors = require('cors');
const fs = require('fs');
const bodyParser = require('body-parser');
const { localstorage } = require('./localstorage.js');

const app = express();
const PORT = process.env.PORT || 5000;

// Helper functions
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

if (!fs.existsSync("db")) fs.mkdirSync("db");
if (!fs.existsSync("db/localstorage.json")) fs.writeFileSync("db/localstorage.json", "{}");

// Route to receive test site data
app.post('/getdata/checkpoint', (req, res) => {
    const { userId, checkpointId, tijd } = req.body;
    
    if (!userId || !checkpointId || !tijd) {
        return res.status(400).json({ error: 'Missing fields (userId, checkpointId, tijd)' });
    }

    // Get current runs data or initialize
    let runs = localstorage.getItem('runs');
    if (!runs) runs = {};

    // If start checkpoint, create new run
    if (checkpointId === 'start') {
        runs[userId] = [{ checkpointId, tijd }];
    }

    // If middle checkpoint -> append
    else if (checkpointId === 'midden') {
        if (!runs[userId]) runs[userId] = [];
        runs[userId].push({ checkpointId, tijd });
    }

    // If end checkpoint -> append + calculate time
    else if (checkpointId === 'eind') {
        if (!runs[userId]) runs[userId] = [];
        runs[userId].push({ checkpointId, tijd });

        const start = runs[userId].find(c => c.checkpointId === 'start');
        if (start) {
            const runtime = calculateRuntime(start.tijd, tijd);
            runs[userId].push({ runtime });
        }
    }

    // Save updated runs
    localstorage.setItem('runs', runs);

    res.json({
        message: "Checkpoint saved successfully",
        user: userId,
        data: runs[userId]
    });
});

// Helper: calculate time in minutes
function calculateRuntime(startTime, endTime) {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
}


app.listen(PORT, () => console.log("Server running on: http://localhost:" + PORT));


// Return leaderboard
app.get('/senddata/publiclb', (req, res) => {
    const runs = localstorage.getItem('runs');

    const leaderboard = [];

    // Iterate each user
    for (const userId in runs) {
        const userRuns = runs[userId];
        // Filter out runs without runtime
        const completedRuns = userRuns.filter(run => run.runtime !== undefined);
        if (completedRuns.length === 0) continue;

        // Get the **best run** (smallest runtime)
        const bestRun = completedRuns.reduce((prev, curr) => {
            return curr.runtime < prev.runtime ? curr : prev;
        });

        leaderboard.push({
            userId,
            runtime: bestRun.runtime,
            lastCheckpointTime: bestRun.tijd
        });
    }

    // Sort leaderboard by runtime ascending (best first)
    leaderboard.sort((a, b) => a.runtime - b.runtime);

    res.json(leaderboard);
});
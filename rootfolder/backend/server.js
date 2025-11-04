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


app.listen(PORT, () => console.log("Server running on: https://nieuwedirtyhillserver.onrender.com:" + PORT));


// Return public leaderboard
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

// Return personal leaderboard
app.get('/senddata/personallb/:userId', (req, res) => {
    const runs = localstorage.getItem('runs') || {};
    const userId = req.params.userId;

    if (!runs[userId]) {
        return res.json({ message: "No runs found for this user", leaderboard: [] });
    }

    // Filter alle runs van de user op entries met runtime
    const completedRuns = runs[userId].filter(run => run.runtime !== undefined);
    const leaderboard = completedRuns.map(run => ({
        userId,
        runtime: run.runtime,
        lastCheckpointTime: run.tijd || null
    }));

    // Sorteer op snelste tijd
    leaderboard.sort((a, b) => a.runtime - b.runtime);

    res.json({ leaderboard });
});







// Return social leaderboard











// Login
app.post('/senddata/login', (req, res) => {
    const { username, password } = req.body;
    const db = localstorage.getItem('users') || {};

    const user = db[username];
    if (user && user.password === password) {
        res.json({ success: true, message: 'Login successful', username });
    } else {
        res.json({ success: false, message: 'Invalid username or password' });
    }
});


// Register
app.post('/senddata/register', (req, res) => {
    const { username, password } = req.body;
    let db = localstorage.getItem('users');

    if (!db) db = {}; // als 'users' nog niet bestaat

    if (db[username]) {
        return res.json({ success: false, message: 'Username already exists' });
    }

    db[username] = { password };
    localstorage.setItem('users', db);

    res.json({ success: true, message: 'Registration successful' });
});

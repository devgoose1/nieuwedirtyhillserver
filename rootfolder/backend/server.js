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

// Receive checkpoint data
app.post('/getdata/checkpoint', (req, res) => {
    const { userId, checkpointId, tijd } = req.body;
    
    if (!userId || !checkpointId || !tijd) {
        return res.status(400).json({ error: 'Missing fields (userId, checkpointId, tijd)' });
    }

    // Haal huidige runs op of initialiseer
    let runs = localstorage.getItem('runs') || {};
    if (!runs[userId]) runs[userId] = [];

    // Start checkpoint -> nieuwe run toevoegen
    if (checkpointId === 'start') {
        runs[userId].push([{ checkpointId, tijd }]);
    } else {
        // Voor midden of eind -> voeg toe aan laatste run
        const currentRun = runs[userId][runs[userId].length - 1];
        if (!currentRun) {
            return res.status(400).json({ error: 'No start checkpoint found for this run' });
        }

        currentRun.push({ checkpointId, tijd });

        // Eind checkpoint -> runtime berekenen
        if (checkpointId === 'eind') {
            const start = currentRun.find(c => c.checkpointId === 'start');
            if (start) {
                const runtime = calculateRuntime(start.tijd, tijd);
                currentRun.push({ runtime });
            }
        }
    }

    // Sla updated runs op
    localstorage.setItem('runs', runs);

    res.json({
        message: "Checkpoint saved successfully",
        user: userId,
        data: runs[userId][runs[userId].length - 1] // retourneer de laatste run
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
    const runs = localstorage.getItem('runs') || {};

    const leaderboard = [];

    // Iterate each user
    for (const userId in runs) {
        const userRuns = runs[userId]; // array van runs

        // Vind de best run van deze user
        let bestRuntime = Infinity;
        let lastCheckpointTime = null;

        userRuns.forEach(run => {
            const runtimeEntry = run.find(c => c.runtime !== undefined);
            if (runtimeEntry && runtimeEntry.runtime < bestRuntime) {
                bestRuntime = runtimeEntry.runtime;
                lastCheckpointTime = runtimeEntry.tijd || run[run.length - 1].tijd;
            }
        });

        if (bestRuntime !== Infinity) {
            leaderboard.push({
                userId,
                runtime: bestRuntime,
                lastCheckpointTime
            });
        }
    }

    // Sorteer op runtime, kleinste eerst
    leaderboard.sort((a, b) => a.runtime - b.runtime);

    res.json(leaderboard);
});


app.get('/senddata/personallb/:userId', (req, res) => {
    const runs = localstorage.getItem('runs') || {};
    const userId = req.params.userId;

    if (!runs[userId]) {
        return res.json({ message: "No runs found for this user", leaderboard: [] });
    }

    // Haal alle runtimes van deze user
    const leaderboard = runs[userId]
        .map(run => {
            const runtimeEntry = run.find(c => c.runtime !== undefined);
            if (!runtimeEntry) return null;
            return {
                userId,
                runtime: runtimeEntry.runtime,
                lastCheckpointTime: runtimeEntry.tijd || run[run.length - 1].tijd
            };
        })
        .filter(r => r !== null)
        .sort((a, b) => a.runtime - b.runtime);

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

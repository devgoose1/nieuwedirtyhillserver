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

        if (!Array.isArray(userRuns)) continue; // skip corrupt/oud formaat

        let bestRuntime = Infinity;
        let lastCheckpointTime = null;

        userRuns.forEach(run => {
            if (!Array.isArray(run)) return; // skip oud formaat of corrupt data
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

// Return personal leaderboard
app.get('/senddata/personallb/:userId', (req, res) => {
    const runs = localstorage.getItem('runs') || {};
    const userId = req.params.userId;

    if (!runs[userId]) {
        return res.json({ message: "No runs found for this user", leaderboard: [] });
    }

    // Haal alle runtimes van deze user
    const leaderboard = runs[userId]
        .filter(run => Array.isArray(run)) // alleen arrays
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


// Maak een nieuwe social leaderboard
app.post('/senddata/slb/create', (req, res) => {
    const { groupName, creator } = req.body;
    if (!groupName || !creator) return res.status(400).json({ error: 'Missing fields' });

    let slbs = localstorage.getItem('socialLeaderboards') || {};
    if (slbs[groupName]) return res.json({ success: false, message: 'Group already exists' });

    slbs[groupName] = {
        creator,
        members: [creator],
        invitations: []
    };

    localstorage.setItem('socialLeaderboards', slbs);
    res.json({ success: true, message: 'Social leaderboard created', groupName });
});


// Nodig een gebruiker uit voor een SLB-groep
app.post('/senddata/slb/invite', (req, res) => {
    const { groupName, username, invitedBy } = req.body;
    if (!groupName || !username || !invitedBy) return res.status(400).json({ error: 'Missing fields' });

    let slbs = localstorage.getItem('socialLeaderboards') || {};
    if (!slbs[groupName]) return res.status(404).json({ error: 'Group not found' });

    // Voeg toe aan invitations
    slbs[groupName].invitations.push({ username, invitedBy });
    localstorage.setItem('socialLeaderboards', slbs);
    res.json({ success: true, message: 'Invitation sent' });
});


// Haal alle uitnodigingen op voor een user
app.get('/senddata/slb/invitations/:username', (req, res) => {
    const username = req.params.username;
    let slbs = localstorage.getItem('socialLeaderboards') || {};

    const invites = [];
    for (const groupName in slbs) {
        slbs[groupName].invitations.forEach(invite => {
            if (invite.username === username) {
                invites.push({
                    groupName,
                    invitedBy: invite.invitedBy
                });
            }
        });
    }

    res.json({ invitations: invites });
});



// Accept invite
app.post('/senddata/slb/accept', (req, res) => {
    const { groupName, username } = req.body;
    let slbs = localstorage.getItem('socialLeaderboards') || {};
    if (!slbs[groupName]) return res.status(404).json({ error: 'Group not found' });

    // Voeg user toe aan members als nog niet aanwezig
    if (!slbs[groupName].members.includes(username)) {
        slbs[groupName].members.push(username);
    }

    // Verwijder uitnodiging
    slbs[groupName].invitations = slbs[groupName].invitations.filter(inv => inv.username !== username);

    localstorage.setItem('socialLeaderboards', slbs);
    res.json({ success: true, message: 'Joined group', groupName });
});



// Haal alle SLB-groepen waar de gebruiker in zit
app.get('/senddata/slb/mygroups/:username', (req, res) => {
    const username = req.params.username;
    const slbs = localstorage.getItem('socialLeaderboards') || {};
    const groups = [];

    for (const groupName in slbs) {
        const group = slbs[groupName];
        if (group.members.includes(username)) {
            groups.push(groupName);
        }
    }

    res.json({ groups });
});




// Beste tijden van alle leden van een SLB-groep
app.get('/senddata/slb/:groupName', (req, res) => {
    const groupName = req.params.groupName;
    let slbs = localstorage.getItem('socialLeaderboards') || {};
    let runs = localstorage.getItem('runs') || {};

    if (!slbs[groupName]) return res.status(404).json({ error: 'Group not found' });

    const members = slbs[groupName].members;
    const leaderboard = [];

    members.forEach(userId => {
        const userRuns = runs[userId] || [];
        if (!Array.isArray(userRuns)) return;

        let bestRuntime = Infinity;
        userRuns.forEach(run => {
            if (!Array.isArray(run)) return;
            const runtimeEntry = run.find(c => c.runtime !== undefined);
            if (runtimeEntry && runtimeEntry.runtime < bestRuntime) {
                bestRuntime = runtimeEntry.runtime;
            }
        });

        if (bestRuntime !== Infinity) {
            leaderboard.push({ userId, runtime: bestRuntime });
        }
    });

    // Sorteer op runtime
    leaderboard.sort((a, b) => a.runtime - b.runtime);

    res.json({ groupName, leaderboard });
});

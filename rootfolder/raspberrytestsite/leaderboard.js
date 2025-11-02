async function loadLeaderboard() {
    try {
        const res = await fetch('http://localhost:5000/api/leaderboard');
        const leaderboard = await res.json();

        const container = document.getElementById('leaderboard');
        container.innerHTML = '';

        leaderboard.forEach((entry, index) => {
            const div = document.createElement('div');
            div.textContent = `${index + 1}. ${entry.userId} - ${entry.runtime} min`;
            container.appendChild(div);
        });
    } catch (err) {
        document.getElementById('leaderboard').textContent = 'Error loading leaderboard: ' + err;
    }
}

// Refresh leaderboard every 5 seconds
setInterval(loadLeaderboard, 5000);
loadLeaderboard(); // initial load

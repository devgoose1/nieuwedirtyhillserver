const fs = require('fs');

let internal = {}

if (fs.existsSync('db/localstorage.json')) {
    const file =fs.readFileSync('db/localstorage.json');
    const localStorage = JSON.parse(file);
    internal = localStorage;
}

function save() {
    fs.writeFileSync('db/localstorage.json', JSON.stringify(internal, null, 2));
}

const localstorage = {
    getItem: (key) => {
        return internal[key] || null;
    },
    setItem: (key, value) => {
        internal[key] = value;
        save();
    },
    removeItem: (key) => {
        delete internal[key];
        save();
    }
};

module.exports = { localstorage}
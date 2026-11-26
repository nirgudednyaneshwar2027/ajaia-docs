'use strict';
const { createApp } = require('./app');

const port = process.env.PORT || 3001;
const dbFile = process.env.DB_FILE || './data.sqlite';
createApp({ dbFile }).listen(port, () => console.log(`Ajaia Docs listening on :${port} (db: ${dbFile})`));

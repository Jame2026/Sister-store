const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes');
const { corsOptions, uploadsRoot, handleUploadError } = require('./services/storeService');

const app = express();

app.use(cors(corsOptions));
app.use(express.json());
app.use('/uploads', express.static(uploadsRoot));
app.use('/api', apiRoutes);
app.use(handleUploadError);

module.exports = app;

const express = require('express');
const router = express.Router();
const path = require('path');

router.get('/', (req, res, next) => {
    return res.sendFile(path.resolve(__dirname+"/../views/chat.html"));
});

module.exports = router
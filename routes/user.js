const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../models');

//GET Login Page
router.get('/', (req, res, next) => {
    return res.sendFile(path.resolve(__dirname+"/../views/login.html"));
});

//POST Login
router.post('/', async (req, res, next) => {
    const {userId, password} = req.body;
    db.members.findOne({
        where: {
            userId: userId
        }
    })
    .then(result => {
        res.json(result);
    })
    .catch(e => {
        console.error(e);
    })

});

//GET Register Page
router.get('/register', (req, res, next) => {
    res.sendFile(path.resolve(__dirname+"/../views/register.html"));
});

//POST Register
router.post('/register', (req, res, next) => {
    //(미개발) id 유효성 검사
    //(미개발) password 암호화
    //TypeError: Cannot destructure property 'userId' of 'req.body' as it is undefined.
    const {userId, password} = req.body;
    db.members.create(
        {userId, password})
    .then(result => {
        res.json(result);
    })
    .catch(e => {
        console.error(e);
    })
});

module.exports = router
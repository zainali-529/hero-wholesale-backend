const express = require('express');
const router = express.Router();
const { authUser, registerUser } = require('../controllers/authController');
const { protect, admin } = require('../middleware/authMiddleware');

router.post('/login', authUser);
router.post('/', registerUser); // Typically you'd protect this too, but for initial setup we leave it public or protect it

module.exports = router;

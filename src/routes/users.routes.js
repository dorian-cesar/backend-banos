const express = require('express');
const router = express.Router('./routes/index.routes');
const usersController = require('../controllers/users.controller');

router.get('/', usersController.getAllUsers);
router.get('/:id', usersController.getUserById);
router.post('/', usersController.createUser);
router.put('/:id', usersController.updateUser);
router.delete('/:id', usersController.deleteUser);

module.exports = router;

const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  getBanners,
  createBanner,
  updateBanner,
  deleteBanner,
} = require('../controllers/bannerController');
const { protect, admin } = require('../middleware/authMiddleware');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.route('/').get(getBanners).post(protect, admin, upload.single('image'), createBanner);
router
  .route('/:id')
  .put(protect, admin, upload.single('image'), updateBanner)
  .delete(protect, admin, deleteBanner);

module.exports = router;

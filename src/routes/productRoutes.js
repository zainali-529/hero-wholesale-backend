const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkUploadProducts,
} = require('../controllers/productController');
const { protect, admin } = require('../middleware/authMiddleware');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.route('/').get(getProducts).post(protect, admin, upload.single('image'), createProduct);

router.post(
  '/bulk-upload',
  protect,
  admin,
  upload.fields([
    { name: 'csvFile', maxCount: 1 },
    { name: 'images', maxCount: 100 }, // Allow up to 100 images
  ]),
  bulkUploadProducts
);

router
  .route('/:id')
  .get(getProductById)
  .put(protect, admin, upload.single('image'), updateProduct)
  .delete(protect, admin, deleteProduct);

module.exports = router;

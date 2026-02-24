const Product = require('../models/Product');
const Category = require('../models/Category');
const { uploadImage, deleteImage } = require('../utils/cloudinary');
const csv = require('csv-parser');
const { Readable } = require('stream');

// @desc    Get all products
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res) => {
  try {
    const pageSize = 10;
    const page = Number(req.query.pageNumber) || 1;

    console.log('Query Params:', req.query); // Debug logging

    const keyword = req.query.keyword
      ? {
          title: {
            $regex: req.query.keyword,
            $options: 'i',
          },
        }
      : {};

    // Filter by category if provided
    const categoryFilter = req.query.category ? { category: req.query.category } : {};

    // Filter by offer of the day if provided
    let offerFilter = {};
    if (req.query.isOfferOfDay === 'true') {
      offerFilter = { isOfferOfDay: true };
    }

    // Filter by featured if provided
    let featuredFilter = {};
    if (req.query.isFeatured === 'true') {
      featuredFilter = { isFeatured: true };
    }

    const count = await Product.countDocuments({ ...keyword, ...categoryFilter, ...offerFilter, ...featuredFilter });
    const products = await Product.find({ ...keyword, ...categoryFilter, ...offerFilter, ...featuredFilter })
      .populate('category', 'name')
      .limit(pageSize)
      .skip(pageSize * (page - 1))
      .sort({ createdAt: -1 });

    res.json({ products, page, pages: Math.ceil(count / pageSize) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('category', 'name');

    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
const createProduct = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an image' });
    }

    // Validate category
    if (!req.body.category) {
        return res.status(400).json({ message: 'Category is required' });
    }
    const categoryExists = await Category.findById(req.body.category);
    if (!categoryExists) {
        return res.status(400).json({ message: 'Invalid Category ID' });
    }

    const result = await uploadImage(req.file.buffer, 'wholesale_site/products');

    const product = new Product({
      title: req.body.title,
      category: req.body.category,
      rate: Number(req.body.rate),
      rating: Number(req.body.rating || 0),
      description: req.body.description,
      image: {
        url: result.secure_url,
        public_id: result.public_id,
      },
      stock: Number(req.body.stock || 0),
      minOrderQuantity: Number(req.body.minOrderQuantity || 1),
      isActive: req.body.isActive === 'true',
      isOfferOfDay: req.body.isOfferOfDay === 'true',
      isFeatured: req.body.isFeatured === 'true',
    });

    const createdProduct = await product.save();
    res.status(201).json(createdProduct);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // If new image is uploaded
    if (req.file) {
      // Delete old image
      if (product.image && product.image.public_id) {
        await deleteImage(product.image.public_id);
      }

      // Upload new image
      const result = await uploadImage(req.file.buffer, 'wholesale_site/products');
      
      product.image = {
        url: result.secure_url,
        public_id: result.public_id,
      };
    }

    if (req.body.title) product.title = req.body.title;
    if (req.body.category) {
         const categoryExists = await Category.findById(req.body.category);
         if (!categoryExists) {
             return res.status(400).json({ message: 'Invalid Category ID' });
         }
         product.category = req.body.category;
    }
    if (req.body.rate) product.rate = Number(req.body.rate);
    if (req.body.rating) product.rating = Number(req.body.rating);
    if (req.body.description) product.description = req.body.description;
    if (req.body.stock) product.stock = Number(req.body.stock);
    if (req.body.minOrderQuantity) product.minOrderQuantity = Number(req.body.minOrderQuantity);
    if (req.body.isActive !== undefined) product.isActive = req.body.isActive === 'true';
    if (req.body.isOfferOfDay !== undefined) product.isOfferOfDay = req.body.isOfferOfDay === 'true';
    if (req.body.isFeatured !== undefined) product.isFeatured = req.body.isFeatured === 'true';

    const updatedProduct = await product.save();
    res.json(updatedProduct);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Delete image from Cloudinary
    if (product.image && product.image.public_id) {
      await deleteImage(product.image.public_id);
    }

    await product.deleteOne();
    res.json({ message: 'Product removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Bulk upload products from CSV
// @route   POST /api/products/bulk-upload
// @access  Private/Admin
const bulkUploadProducts = async (req, res) => {
  try {
    if (!req.files || !req.files.csvFile) {
      return res.status(400).json({ message: 'Please upload a CSV file' });
    }
    
    // Get CSV file buffer
    const csvFile = req.files.csvFile[0];
    const imageFiles = req.files.images || []; // Array of image files
    
    const results = [];
    const errors = [];
    
    // Create map of filename -> file buffer for quick lookup
    const imageMap = new Map();
    imageFiles.forEach(file => {
      imageMap.set(file.originalname, file);
    });
    
    // Cache categories to avoid DB hits
    const categories = await Category.find({});
    const categoryMap = new Map();
    categories.forEach(cat => {
      categoryMap.set(cat.name.toLowerCase(), cat._id);
    });

    const stream = Readable.from(csvFile.buffer);
    
    stream
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        const createdProducts = [];
        
        // Process each row
        // Using for...of to process sequentially (or we could use Promise.all with chunking for speed)
        // For image uploads, we should limit concurrency
        
        const CONCURRENCY_LIMIT = 5;
        for (let i = 0; i < results.length; i += CONCURRENCY_LIMIT) {
          const chunk = results.slice(i, i + CONCURRENCY_LIMIT);
          
          await Promise.all(chunk.map(async (row, index) => {
            const rowNumber = i + index + 1;
            try {
              // Basic validation
              if (!row.title || !row.rate || !row.category) {
                errors.push(`Row ${rowNumber}: Missing required fields (title, rate, category)`);
                return;
              }

              // Resolve Category
              const categoryId = categoryMap.get(row.category.toLowerCase().trim());
              if (!categoryId) {
                errors.push(`Row ${rowNumber}: Category '${row.category}' not found`);
                return;
              }

              // Handle Image
              let imageData = {
                url: 'https://via.placeholder.com/150', // Default placeholder
                public_id: 'placeholder'
              };

              if (row.image) {
                const imageFile = imageMap.get(row.image.trim());
                if (imageFile) {
                  try {
                    const result = await uploadImage(imageFile.buffer, 'wholesale_site/products');
                    imageData = {
                      url: result.secure_url,
                      public_id: result.public_id
                    };
                  } catch (uploadErr) {
                    errors.push(`Row ${rowNumber}: Image upload failed for ${row.image}`);
                    return; // Skip product creation if image fails (strict mode) or continue with placeholder? Let's skip.
                  }
                } else {
                   // If image specified in CSV but not found in uploads
                   errors.push(`Row ${rowNumber}: Image file '${row.image}' not provided`);
                   return;
                }
              }

              const product = new Product({
                title: row.title,
                category: categoryId,
                rate: Number(row.rate),
                rating: Number(row.rating || 0),
                description: row.description || '',
                image: imageData,
                stock: Number(row.stock || 0),
                minOrderQuantity: Number(row.minOrderQuantity || 1),
                isActive: true
              });

              const savedProduct = await product.save();
              createdProducts.push(savedProduct);
              
            } catch (err) {
              errors.push(`Row ${rowNumber}: ${err.message}`);
            }
          }));
        }

        res.json({
          message: `Processed ${results.length} rows`,
          successCount: createdProducts.length,
          errorCount: errors.length,
          errors: errors,
          createdProducts: createdProducts
        });
      });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkUploadProducts,
};

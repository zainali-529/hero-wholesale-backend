const Banner = require('../models/Banner');
const { uploadImage, deleteImage } = require('../utils/cloudinary');

// @desc    Get all banners
// @route   GET /api/banners
// @access  Public
const getBanners = async (req, res) => {
  try {
    const banners = await Banner.find({}).sort({ createdAt: -1 });
    res.json(banners);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a banner
// @route   POST /api/banners
// @access  Private/Admin
const createBanner = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an image' });
    }

    const result = await uploadImage(req.file.buffer, 'wholesale_site/banners');

    const banner = new Banner({
      title: req.body.title,
      image: {
        url: result.secure_url,
        public_id: result.public_id,
      },
      link: req.body.link,
      isActive: req.body.isActive === 'true', // Handle multipart/form-data string boolean
    });

    const createdBanner = await banner.save();
    res.status(201).json(createdBanner);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a banner
// @route   PUT /api/banners/:id
// @access  Private/Admin
const updateBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({ message: 'Banner not found' });
    }

    // If new image is uploaded, delete old one and upload new one
    if (req.file) {
      // Delete old image from Cloudinary
      if (banner.image && banner.image.public_id) {
        await deleteImage(banner.image.public_id);
      }

      // Upload new image
      const result = await uploadImage(req.file.buffer, 'wholesale_site/banners');
      
      banner.image = {
        url: result.secure_url,
        public_id: result.public_id,
      };
    }

    // Update other fields if provided
    if (req.body.title !== undefined) banner.title = req.body.title;
    if (req.body.link !== undefined) banner.link = req.body.link;
    if (req.body.isActive !== undefined) banner.isActive = req.body.isActive === 'true';

    const updatedBanner = await banner.save();
    res.json(updatedBanner);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a banner
// @route   DELETE /api/banners/:id
// @access  Private/Admin
const deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({ message: 'Banner not found' });
    }

    // Delete image from Cloudinary
    if (banner.image && banner.image.public_id) {
      await deleteImage(banner.image.public_id);
    }

    await banner.deleteOne();
    res.json({ message: 'Banner removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getBanners,
  createBanner,
  updateBanner,
  deleteBanner,
};

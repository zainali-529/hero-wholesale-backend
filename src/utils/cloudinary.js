const cloudinary = require('../config/cloudinary');
const { Readable } = require('stream');

const uploadImage = (buffer, folder = 'wholesale_site/banners') => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve(result);
      }
    );
    
    const readable = new Readable();
    readable._read = () => {};
    readable.push(buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });
};

const deleteImage = async (publicId) => {
  try {
    if (!publicId) return;
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    // We don't throw here to avoid breaking the main flow if image delete fails, 
    // but in a strict system we might want to handle it.
  }
};

module.exports = { uploadImage, deleteImage };

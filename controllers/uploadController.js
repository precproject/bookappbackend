const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Ensure the folder for saving images exists
const uploadDir = path.join(__dirname, '../public/uploads');
if (process.env.NODE_ENV === 'development') {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
}
// 1. Receive the file into memory safely (Limit size to 5MB)
const multerStorage = multer.memoryStorage();
const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new Error('Please upload only images.'), false);
  }
};

exports.upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB maximum
});

// 2. Process, shrink, and save the image
exports.processAndSaveImage = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No image file uploaded.' });
  }

  try {
    // Create a safe, unique name for the file
    const uniqueName = `image-${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
    const outputPath = path.join(uploadDir, uniqueName);

    // Shrink the image and convert it to WebP format (very lightweight)
    await sharp(req.file.buffer)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true }) // Prevent it from being too wide/tall
      .toFormat('webp')
      .webp({ quality: 80 }) // 80% quality saves massive space but looks identical
      .toFile(outputPath);

    // Automatically build the correct URL (Works for both localhost and live domain)
    // const protocol = req.protocol;
    // const host = req.get('host');
    // const fullUrl = `${protocol}://${host}/uploads/${uniqueName}`;


    const baseUrl = process.env.API_BASE_URL || 'http://localhost:5001';
    const fullUrl = `${baseUrl}/uploads/${uniqueName}`;
    
    res.status(200).json({
      message: 'Image uploaded securely',
      imageUrl: fullUrl
    });

  } catch (error) {
    console.error("Image processing error:", error);
    res.status(500).json({ message: 'Failed to process image.' });
  }
};
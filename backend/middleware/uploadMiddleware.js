const multer = require('multer');
const cloudinary = require('cloudinary').v2;

function getCloudinaryConfig() {
  const name = process.env.CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (name && key && secret) {
    cloudinary.config({ cloud_name: name, api_key: key, api_secret: secret });
    return true;
  }
  return false;
}
getCloudinaryConfig();

const memoryStorage = multer.memoryStorage();

const upload = multer({
  storage: memoryStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/webp',
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type'), false);
  },
});

/**
 * Upload buffer to Cloudinary. PDFs/DOC use raw upload so URLs work in browser; images use image.
 */
async function uploadToCloudinary(buffer, folder, resourceTypeHint = 'auto', mimetype = 'application/pdf') {
  const folderPath = folder.startsWith('learnoptima') ? folder : `learnoptima/${folder}`;
  const isImage = mimetype && mimetype.startsWith('image/');
  const resourceType = isImage ? 'image' : mimetype === 'application/pdf' || mimetype === 'application/msword' || mimetype?.includes('word') ? 'raw' : 'raw';
  const b64 = buffer.toString('base64');
  const dataUri = `data:${mimetype || 'application/octet-stream'};base64,${b64}`;
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      dataUri,
      {
        folder: folderPath,
        resource_type: resourceType,
        use_filename: false,
      },
      (err, result) => (err ? reject(err) : resolve(result)),
    );
  });
}

const resumeUpload = upload.single('resume');
const syllabusUpload = upload.single('syllabus');
const timetableUpload = upload.single('timetable');

module.exports = {
  upload,
  resumeUpload,
  syllabusUpload,
  timetableUpload,
  uploadToCloudinary,
};

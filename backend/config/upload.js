const multer = require('multer');
const path = require('path');
const fs = require('fs');

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

ensureDir(path.join(__dirname, '../uploads/profiles'));
ensureDir(path.join(__dirname, '../uploads/poojas'));
ensureDir(path.join(__dirname, '../uploads/products'));
ensureDir(path.join(__dirname, '../uploads/videos'));
ensureDir(path.join(__dirname, '../uploads/chat'));
ensureDir(path.join(__dirname, '../uploads/completions'));

const createStorage = (folder) =>
  multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, `../uploads/${folder}`)),
    filename: (req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${path.extname(file.originalname).toLowerCase()}`);
    },
  });

const imageFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp/;
  if (allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG, PNG, and WEBP images are allowed.'));
  }
};

const videoFilter = (req, file, cb) => {
  const allowed = /mp4|mov|avi|mkv|webm|m4v/;
  if (allowed.test(path.extname(file.originalname).toLowerCase())) {
    cb(null, true);
  } else {
    cb(new Error('Only MP4, MOV, AVI, MKV, WEBM video files are allowed.'));
  }
};

const imgOpts   = { limits: { fileSize: 5  * 1024 * 1024 }, fileFilter: imageFilter }; // 5 MB
const videoOpts = { limits: { fileSize: 500 * 1024 * 1024 }, fileFilter: videoFilter }; // 500 MB

const uploadProfilePhoto       = multer({ storage: createStorage('profiles'),    ...imgOpts });
const uploadPoojaImage         = multer({ storage: createStorage('poojas'),      ...imgOpts });
const uploadProductImage       = multer({ storage: createStorage('products'),    ...imgOpts });
const uploadPoojaVideo         = multer({ storage: createStorage('videos'),      ...videoOpts });
const uploadChatImage          = multer({ storage: createStorage('chat'),        ...imgOpts });
const uploadCompletionImages   = multer({ storage: createStorage('completions'), ...imgOpts });

module.exports = {
  uploadProfilePhoto,
  uploadPoojaImage,
  uploadProductImage,
  uploadPoojaVideo,
  uploadChatImage,
  uploadCompletionImages,
};

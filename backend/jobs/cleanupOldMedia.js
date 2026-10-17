const fs = require('fs');
const path = require('path');
const OnlineBooking = require('../models/OnlineBooking');

// Completion video/photos are only kept visible to the devotee for 15 days
// after upload, then the files are deleted from disk and the fields cleared.
const MEDIA_TTL_MS = 15 * 24 * 60 * 60 * 1000;

function deleteUploadedFile(folder, filename) {
  if (!filename) return;
  const fp = path.join(__dirname, `../uploads/${folder}`, path.basename(filename));
  if (fs.existsSync(fp)) {
    try { fs.unlinkSync(fp); } catch (_) {}
  }
}

async function cleanupOldOnlineBookingMedia() {
  const cutoff = new Date(Date.now() - MEDIA_TTL_MS);

  // Expire completion videos uploaded more than 15 days ago.
  const expiredVideoBookings = await OnlineBooking.find({
    videoUploadedAt: { $lte: cutoff },
  }).select('videoFile videoUploadedAt');

  for (const booking of expiredVideoBookings) {
    deleteUploadedFile('videos', booking.videoFile);
    booking.videoFile = '';
    booking.videoOriginalName = '';
    booking.videoUrl = '';
    booking.videoExternalUrl = '';
    booking.videoUploadedAt = undefined;
    await booking.save();
  }

  // Expire individual completion images more than 15 days old (per-image,
  // since a booking can accumulate images uploaded on different days).
  const bookingsWithImages = await OnlineBooking.find({
    'completionImages.0': { $exists: true },
  }).select('completionImages');

  let imagesExpired = 0;
  for (const booking of bookingsWithImages) {
    const remaining = booking.completionImages.filter((img) => {
      const expired = img.uploadedAt && img.uploadedAt <= cutoff;
      if (expired) {
        deleteUploadedFile('completions', img.filename);
        imagesExpired += 1;
      }
      return !expired;
    });
    if (remaining.length !== booking.completionImages.length) {
      booking.completionImages = remaining;
      await booking.save();
    }
  }

  if (expiredVideoBookings.length || imagesExpired) {
    console.log(
      `[media-cleanup] cleared ${expiredVideoBookings.length} expired video(s) and ${imagesExpired} expired image(s).`
    );
  }
}

module.exports = { cleanupOldOnlineBookingMedia, MEDIA_TTL_MS };

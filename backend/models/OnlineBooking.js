const mongoose = require('mongoose');

const onlineBookingSchema = new mongoose.Schema(
  {
    userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    onlinePoojaId: { type: mongoose.Schema.Types.ObjectId, ref: 'OnlinePooja', required: true },
    amount:        { type: Number, required: true },

    // User preferences at booking time
    preferredDate:  { type: Date },
    gotraName:      { type: String, default: '' },      // family gotra
    wishes:         { type: String, default: '' },      // what the user wants to pray for
    memberNames:    { type: String, default: '' },      // names of family members for pooja

    // Payment
    isPaid:              { type: Boolean, default: false },
    razorpayOrderId:     { type: String, default: '' },
    razorpayPaymentId:   { type: String, default: '' },
    razorpaySignature:   { type: String, default: '' },

    // Booking lifecycle
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'assigned', 'in_progress', 'completed', 'cancelled'],
      default: 'pending',
    },
    adminNote: { type: String, default: '' },           // admin can add a note for user

    // Pandit assignment (admin assigns a Temple Pandit to perform the pooja)
    panditId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Pandit' },
    assignedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },   // admin who assigned
    assignedAt:  { type: Date },
    startedAt:   { type: Date },
    completedAt: { type: Date },
    panditNote:  { type: String, default: '' },

    // Video proof (uploaded by admin after pooja is done)
    videoFile:        { type: String, default: '' },    // filename in uploads/videos/
    videoOriginalName:{ type: String, default: '' },    // original filename for download
    videoUrl:         { type: String, default: '' },    // full URL to serve the file
    videoExternalUrl: { type: String, default: '' },    // optional YouTube/Drive link
    videoUploadedAt:  { type: Date },

    // Photo proof (optional — admin can upload multiple completion images)
    completionImages: [{
      filename:   { type: String },
      url:        { type: String },
      caption:    { type: String, default: '' },
      uploadedAt: { type: Date, default: Date.now },
    }],
    completionNotes: { type: String, default: '' },     // admin-authored notes shown to user
  },
  { timestamps: true }
);

onlineBookingSchema.index({ panditId: 1 });

onlineBookingSchema.index({ userId: 1 });
onlineBookingSchema.index({ onlinePoojaId: 1 });
onlineBookingSchema.index({ status: 1 });

module.exports = mongoose.model('OnlineBooking', onlineBookingSchema);

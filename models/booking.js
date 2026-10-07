const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const bookingSchema = new Schema({
  listing: {
    type: Schema.Types.ObjectId,
    ref: "Listing",
    required: true
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  checkIn: {
    type: Date,
    required: true
  },
  checkOut: {
    type: Date,
    required: true
  },
  guests: {
    type: Number,
    required: true,
    min: 1
  },
  guestBreakdown: {
    adults: { type: Number, default: 1, min: 0 },
    children: { type: Number, default: 0, min: 0 },
    infants: { type: Number, default: 0, min: 0 },
    pets: { type: Number, default: 0, min: 0 }
  },
  nights: {
    type: Number,
    required: true,
    min: 1
  },
  basePrice: {
    type: Number,
    required: true
  },
  gst: {
    type: Number,
    default: 0.18 // 18% GST
  },
  totalPrice: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ["pending", "confirmed", "cancelled"],
    default: "pending"
  },
  paymentStatus: {
    type: String,
    enum: ["unpaid", "paid", "failed", "refunded"],
    default: "unpaid"
  },
  razorpayOrderId: {
    type: String
  },
  razorpayPaymentId: {
    type: String
  },
  razorpaySignature: {
    type: String
  }
}, { timestamps: true });

module.exports = mongoose.model("Booking", bookingSchema);
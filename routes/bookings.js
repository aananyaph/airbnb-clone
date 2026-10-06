const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const Booking = require("../models/booking.js");
const Listing = require("../models/listing.js");
const crypto = require("crypto");
const Payment = require("../models/payment.js");
const { isLoggedIn } = require("../middleware.js");

// POST /listings/:id/bookings - Create a new booking (pending + Razorpay order)
router.post("/:id/bookings", isLoggedIn, wrapAsync(async (req, res) => {
  const { id } = req.params;
  const { checkIn, checkOut, guests } = req.body;
  const listing = await Listing.findById(id);
  
  if (!listing) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }
  
  // Check if user is the owner - they cannot book their own listing
  if (listing.owner.equals(req.user._id)) {
    req.flash("error", "You cannot book your own listing!");
    return res.redirect(`/listings/${id}`);
  }
  
  // Validate dates
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  
  if (checkOutDate <= checkInDate) {
    req.flash("error", "Check-out date must be after check-in date!");
    return res.redirect(`/listings/${id}`);
  }
  
  // Check if dates are in the past
  const today = new Date();
  if (checkInDate < today) {
    req.flash("error", "Cannot book for past dates!");
    return res.redirect(`/listings/${id}`);
  }
  
  // Calculate nights
  const nights = (checkOutDate - checkInDate) / (1000 * 60 * 60 * 24);
  
  // Check for overlapping confirmed bookings (ignore pending ones)
  const overlappingBookings = await Booking.find({
    listing: id,
    status: "confirmed",
    // Check if the new booking overlaps with existing confirmed ones
    $or: [
      { checkIn: { $lt: checkOutDate }, checkOut: { $gt: checkInDate } }
    ]
  });
  
  if (overlappingBookings.length > 0) {
    req.flash("error", "These dates are already booked for this listing!");
    return res.redirect(`/listings/${id}`);
  }
  
  // Calculate prices
  const basePrice = listing.price * nights;
  const gstRate = 0.18; // 18% GST
  const gst = Math.round(basePrice * gstRate);
  const totalPrice = basePrice + gst;
  
  // Create the booking as "pending"
  const booking = new Booking({
    listing: id,
    user: req.user._id,
    checkIn: checkInDate,
    checkOut: checkOutDate,
    guests: guests || 1,
    nights: nights,
    basePrice: basePrice,
    gst: gst,
    totalPrice: totalPrice,
    status: "pending",
    paymentStatus: "unpaid"
  });
  
  await booking.save();
  
  // Create Razorpay order
  const receipt = `booking_${booking._id}`;
  const razorpayOrderOptions = {
    amount: totalPrice * 100, // amount in paise
    currency: "INR",
    receipt: receipt
  };
  
  // Return booking and order details as JSON for Razorpay integration
  res.json({
    success: true,
    bookingId: booking._id,
    amount: totalPrice * 100,
    currency: 'INR',
    booking: {
      id: booking._id,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      totalPrice: booking.totalPrice
    }
  });
  // NOTE: Removed redirect - client-side JS handles Razorpay flow
});

// POST /bookings/:id/verify - Verify Razorpay payment signature
router.post("/:id/verify", isLoggedIn, wrapAsync(async (req, res) => {
  const { id } = req.params;
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
  
  const booking = await Booking.findById(id);
  
  if (!booking) {
    return res.json({ success: false, message: "Booking not found!" });
  }
  
  // Only the booking owner can verify payment
  if (!booking.user.equals(req.user._id)) {
    return res.json({ success: false, message: "You do not have permission to verify this payment!" });
  }
  
  // Check if already paid or cancelled
  if (booking.paymentStatus !== "unpaid") {
    return res.json({ success: false, message: "Payment status is already: " + booking.paymentStatus });
  }
  
  // Verify signature
  const generatedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest("hex");
  
  if (generatedSignature === razorpay_signature) {
    // Payment is valid
    booking.status = "confirmed";
    booking.paymentStatus = "paid";
    booking.razorpayPaymentId = razorpay_payment_id;
    booking.razorpaySignature = razorpay_signature;
    await booking.save();
    
    return res.json({ success: true, message: "Payment successful! Booking confirmed." });
  } else {
    // Payment verification failed
    booking.paymentStatus = "failed";
    booking.razorpayPaymentId = razorpay_payment_id;
    booking.razorpaySignature = razorpay_signature;
    await booking.save();
    
    return res.json({ success: false, message: "Payment verification failed. Please try again." });
  }
}));

// POST /bookings/:id/payment-failed - Mark payment as failed
router.post("/:id/payment-failed", isLoggedIn, wrapAsync(async (req, res) => {
  const { id } = req.params;
  
  const booking = await Booking.findById(id);
  
  if (!booking) {
    return res.json({ success: false, message: "Booking not found!" });
  }
  
  // Only the booking owner can mark payment as failed
  if (!booking.user.equals(req.user._id)) {
    return res.json({ success: false, message: "You do not have permission to do this!" });
  }
  
  booking.paymentStatus = "failed";
  await booking.save();
  
  return res.json({ success: false, message: "Payment failed. Your booking is cancelled." });
}));

module.exports = router;
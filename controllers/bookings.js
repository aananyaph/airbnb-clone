const crypto = require("crypto");
const Booking = require("../models/booking");
const Listing = require("../models/listing");

// Pending bookings block dates for 15 minutes only
function freshPendingCutoff() {
  return new Date(Date.now() - 15 * 60 * 1000);
}

function guestLabel(b) {
  const parts = [];
  const g = b.guestBreakdown || {};
  if (g.adults) parts.push(`${g.adults} adult${g.adults > 1 ? "s" : ""}`);
  if (g.children) parts.push(`${g.children} child${g.children > 1 ? "ren" : ""}`);
  if (g.infants) parts.push(`${g.infants} infant${g.infants > 1 ? "s" : ""}`);
  if (g.pets) parts.push(`${g.pets} pet${g.pets > 1 ? "s" : ""}`);
  return parts.length ? parts.join(", ") : `${b.guests} guest${b.guests > 1 ? "s" : ""}`;
}

/* ======================
   CREATE BOOKING (pending)
   POST /listings/:id/bookings
   Reserve -> pending booking -> redirect to Confirm and pay page
   ====================== */
module.exports.createBooking = async (req, res) => {
  const { id } = req.params;
  const { checkIn, checkOut } = req.body;
  // Default to 1 adult (also covers old cached pages / no-JS submits
  // that send no guest fields at all). Negatives are clamped to 0.
  let adults = parseInt(req.body.adults, 10);
  if (!adults || adults < 1) adults = 1;
  const children = Math.max(0, parseInt(req.body.children, 10) || 0);
  const infants = Math.max(0, parseInt(req.body.infants, 10) || 0);
  const pets = Math.max(0, parseInt(req.body.pets, 10) || 0);

  const listing = await Listing.findById(id);
  if (!listing) {
    req.flash("error", "Listing not found");
    return res.redirect("/listings");
  }

  // Owner cannot book own listing
  if (listing.owner && req.user && listing.owner.equals(req.user._id)) {
    req.flash("error", "You cannot book your own listing");
    return res.redirect(`/listings/${id}`);
  }

  const guests = adults + children;

  // Respect the property's max capacity when the host set one
  if (listing.maxGuests && guests > listing.maxGuests) {
    req.flash("error", `This place sleeps ${listing.maxGuests} at most`);
    return res.redirect(`/listings/${id}`);
  }

  // Validate dates (never trust frontend)
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  if (isNaN(checkInDate) || isNaN(checkOutDate)) {
    req.flash("error", "Please select valid dates");
    return res.redirect(`/listings/${id}`);
  }
  if (checkOutDate <= checkInDate) {
    req.flash("error", "Check-out must be after check-in");
    return res.redirect(`/listings/${id}`);
  }

  // Block past dates (compare date-only)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const inDay = new Date(checkInDate);
  inDay.setHours(0, 0, 0, 0);
  if (inDay < today) {
    req.flash("error", "Cannot book past dates");
    return res.redirect(`/listings/${id}`);
  }

  // Nights (recalculated on server)
  const nights = Math.round((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
  if (!nights || nights < 1) {
    req.flash("error", "Stay must be at least 1 night");
    return res.redirect(`/listings/${id}`);
  }

  // Reject overlap with confirmed bookings + fresh pendings (<15 min old).
  // If the only blocker is your own fresh hold for the SAME dates, reuse it
  // (saves you from the click-twice trap) instead of erroring.
  const overlapping = await Booking.find({
    listing: id,
    $or: [
      { status: "confirmed" },
      { status: "pending", createdAt: { $gt: freshPendingCutoff() } }
    ],
    checkIn: { $lt: checkOutDate },
    checkOut: { $gt: checkInDate }
  });
  if (overlapping.length) {
    const others = overlapping.filter(
      (b) => !(b.status === "pending" && b.user.equals(req.user._id))
    );
    if (!others.length) {
      const same = overlapping.find(
        (b) =>
          new Date(b.checkIn).getTime() === checkInDate.getTime() &&
          new Date(b.checkOut).getTime() === checkOutDate.getTime()
      );
      if (same) {
        return res.redirect(`/bookings/${same._id}/checkout`);
      }
      req.flash("error", "You already hold overlapping dates. Finish or cancel it in My Trips.");
    } else {
      req.flash("error", "Those dates are already booked");
    }
    return res.redirect(`/listings/${id}`);
  }

  // Recalculate price on server from listing price
  const basePrice = listing.price * nights;
  const gst = Math.round(basePrice * 0.18);
  const totalPrice = basePrice + gst;

  const booking = new Booking({
    listing: id,
    user: req.user._id,
    checkIn: checkInDate,
    checkOut: checkOutDate,
    guests,
    guestBreakdown: { adults, children, infants, pets },
    nights,
    basePrice,
    gst,
    totalPrice,
    status: "pending",
    paymentStatus: "unpaid"
  });
  await booking.save();

  res.redirect(`/bookings/${booking._id}/checkout`);
};

/* ======================
   CONFIRM AND PAY PAGE
   GET /bookings/:bookingId/checkout
   ====================== */
module.exports.checkout = async (req, res) => {
  const { bookingId } = req.params;
  const booking = await Booking.findById(bookingId).populate({
    path: "listing",
    populate: { path: "reviews" }
  });
  if (!booking) {
    req.flash("error", "Booking not found");
    return res.redirect("/bookings");
  }
  if (!booking.user.equals(req.user._id)) {
    req.flash("error", "You cannot view this booking");
    return res.redirect("/bookings");
  }
  if (booking.status === "cancelled") {
    req.flash("error", "This booking was cancelled");
    return res.redirect("/bookings");
  }
  if (booking.status === "confirmed") {
    return res.redirect("/bookings");
  }
  // Fresh pendings only: older than 15 min must not block dates
  if (new Date(booking.createdAt) < freshPendingCutoff()) {
    req.flash("error", "Your hold expired. Please pick your dates again.");
    return res.redirect(`/listings/${booking.listing._id}`);
  }

  const listing = booking.listing;
  // Average rating from real reviews (or "New" when none yet)
  let avgRating = null;
  let reviewCount = 0;
  if (listing && listing.reviews && listing.reviews.length) {
    reviewCount = listing.reviews.length;
    const sum = listing.reviews.reduce((s, r) => s + (r.rating || 0), 0);
    avgRating = (sum / reviewCount).toFixed(2);
  }

  // Create Razorpay order on the server (never trust amount from frontend)
  const keyId = process.env.RAZORPAY_KEY_ID || "";
  let orderId = booking.razorpayOrderId || "";
  let paymentsReady = true;
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    paymentsReady = false;
  } else if (!orderId) {
    try {
      const Razorpay = require("razorpay");
      const rzp = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
      });
      const order = await rzp.orders.create({
        amount: booking.totalPrice * 100, // paise
        currency: "INR",
        receipt: `booking_${booking._id}`
      });
      orderId = order.id;
      booking.razorpayOrderId = orderId;
      await booking.save();
    } catch (e) {
      paymentsReady = false;
    }
  }

  res.render("bookings/checkout.ejs", {
    booking,
    listing,
    guestText: guestLabel(booking),
    avgRating,
    reviewCount,
    keyId,
    orderId,
    amountPaise: booking.totalPrice * 100,
    paymentsReady
  });
};

/* ======================
   VERIFY PAYMENT
   POST /bookings/:bookingId/verify
   Only marks paid after HMAC SHA256 signature check
   ====================== */
module.exports.verifyPayment = async (req, res) => {
  const { bookingId } = req.params;
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    return res.json({ success: false, message: "Booking not found" });
  }
  if (!booking.user.equals(req.user._id)) {
    return res.json({ success: false, message: "Not your booking" });
  }
  if (booking.status === "cancelled") {
    return res.json({ success: false, message: "Booking was cancelled" });
  }
  if (booking.paymentStatus === "paid") {
    return res.json({ success: true, message: "Already paid" });
  }

  const generated = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (generated && generated === razorpay_signature) {
    booking.status = "confirmed";
    booking.paymentStatus = "paid";
    booking.razorpayPaymentId = razorpay_payment_id;
    booking.razorpaySignature = razorpay_signature;
    await booking.save();
    req.flash("success", "Payment successful! Booking confirmed.");
    return res.json({ success: true, message: "Payment successful! Booking confirmed." });
  }

  booking.paymentStatus = "failed";
  booking.razorpayPaymentId = razorpay_payment_id || "";
  booking.razorpaySignature = razorpay_signature || "";
  await booking.save();
  return res.json({ success: false, message: "Payment verification failed. Please try again." });
};

/* ======================
   PAYMENT FAILED (popup closed / failed)
   POST /bookings/:bookingId/payment-failed — frees the dates
   ====================== */
module.exports.paymentFailed = async (req, res) => {
  const { bookingId } = req.params;
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    return res.json({ success: false, message: "Booking not found" });
  }
  if (!booking.user.equals(req.user._id)) {
    return res.json({ success: false, message: "Not your booking" });
  }
  booking.paymentStatus = "failed";
  await booking.save();
  return res.json({ success: false, message: "Payment not done. Your dates were released." });
};

/* ======================
   MY TRIPS
   GET /bookings (newest first)
   ====================== */
module.exports.index = async (req, res) => {
  const bookings = await Booking.find({ user: req.user._id })
    .populate({ path: "listing", select: "title price image location" })
    .sort({ createdAt: -1 });
  res.render("bookings/index.ejs", { bookings });
};

/* ======================
   CANCEL BOOKING
   PUT /bookings/:bookingId/cancel (future bookings, owner only)
   ====================== */
module.exports.cancelBooking = async (req, res) => {
  const { bookingId } = req.params;
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    req.flash("error", "Booking not found");
    return res.redirect("/bookings");
  }
  if (!booking.user.equals(req.user._id)) {
    req.flash("error", "You cannot cancel this booking");
    return res.redirect("/bookings");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const inDay = new Date(booking.checkIn);
  inDay.setHours(0, 0, 0, 0);
  if (inDay <= today) {
    req.flash("error", "Only future bookings can be cancelled");
    return res.redirect("/bookings");
  }

  booking.status = "cancelled";
  if (booking.paymentStatus === "paid") {
    booking.paymentStatus = "refunded";
    // TODO: real refund via Razorpay API when payments go live
  }
  await booking.save();

  req.flash("success", "Booking cancelled");
  res.redirect("/bookings");
};

const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const { isLoggedIn } = require("../middleware.js");
const bookingController = require("../controllers/bookings.js");

// GET /bookings - "My Trips" page (newest first)
router.get("/", isLoggedIn, wrapAsync(bookingController.index));

// GET /bookings/:bookingId/checkout - "Confirm and pay" summary page
router.get("/:bookingId/checkout", isLoggedIn, wrapAsync(bookingController.checkout));

// POST /bookings/:bookingId/verify - Razorpay signature check (marks paid only if valid)
router.post("/:bookingId/verify", isLoggedIn, wrapAsync(bookingController.verifyPayment));

// POST /bookings/:bookingId/payment-failed - popup closed/failed, free the dates
router.post("/:bookingId/payment-failed", isLoggedIn, wrapAsync(bookingController.paymentFailed));

// PUT /bookings/:bookingId/cancel - cancel own future booking only
// (cancel form uses POST with ?_method=PUT via method-override)
router.put("/:bookingId/cancel", isLoggedIn, wrapAsync(bookingController.cancelBooking));

module.exports = router;

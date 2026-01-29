const express=require("express");
const router=express.Router();
const User=require("../models/user.js");
const wrapAsync = require("../utils/wrapAsync.js");
const passport=require("passport");
const LocalStrategy=require("passport-local");
const { saveRedirectUrl } = require("../middleware.js");
const usersController=require("../controllers/users.js");
const user = require("../models/user.js");

router
.route("/signup")
.get(usersController.renderSignupForm)
.post(wrapAsync(usersController.signup));

router
.route("/login")
.get(usersController.renderLogin)
.post(saveRedirectUrl,
     passport.authenticate("local",{
    failureFlash:true,
    failureRedirect:"/login"
}),
usersController.login)


router.get("/logout",usersController.logout);
module.exports=router;

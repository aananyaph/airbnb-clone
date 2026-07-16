const User=require("../models/user.js");

module.exports.renderSignupForm=(req,res) => {
    res.render("users/signup.ejs");
};


module.exports.signup=async (req,res) => {
   try{
     let{username,email,password}=req.body;
    const user=new User({username,email});
    const registeredUser=await User.register(user,password);
    console.log(registeredUser);
    req.login(registeredUser, (err) => {
        if(err) return next(err);
          req.flash("success","welcome to wanderlust");
          res.redirect("/listings");
    });
     }
   catch(e){
    req.flash("error",e.message);
    res.redirect("/signup");
   }
};

module.exports.renderLogin=(req,res) => {
    res.render("users/login.ejs");
};

module.exports.login=async (req,res) => {
    req.flash("success","wlc to wanderlust");
    const redirectUrl = req.session.redirectTo || "/listings";
    delete req.session.redirectTo;
    res.redirect(redirectUrl);
};

module.exports.logout=(req,res,next) => {
    req.logout((err) => {
        if(err){
            return next(err);
        }
        req.flash("success","Successfully logged out");
        res.redirect("/listings");
    });
};
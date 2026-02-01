const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongooseImport = require("passport-local-mongoose");
// Handle both CommonJS and ESM default exports
const passportLocalMongoose = passportLocalMongooseImport && passportLocalMongooseImport.default ? passportLocalMongooseImport.default : passportLocalMongooseImport;

const UserSchema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true
    }
});

// Add username field (passport-local-mongoose expects this)
// Use email as the username field
UserSchema.plugin(passportLocalMongoose, {
    usernameField: 'email'
});

module.exports = mongoose.model("User", UserSchema);
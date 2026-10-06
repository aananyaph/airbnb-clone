const mongoose=require("mongoose");
const initdata=require("./data.js");
const Listing=require("../models/listing.js");
const MONGO_URL="mongodb://127.0.0.1:27017/wanderlust";

main()
.then(() => {
    console.log("connected to db");
})
.catch((err) => {
    console.log(err);
});

async function main() {
    await mongoose.connect("mongodb://127.0.0.1:27017/wanderlust");
}
async function main(){
    await mongoose.connect(MONGO_URL);
}
const initDb=async () => {
    await Listing.deleteMany({});
    await Listing.insertMany(initdata.data);
    console.log("data was initialsed");

};
initDb();
const mongoose = require('mongoose');

// const connectDB = async () => {
//   try {
//     const conn = await mongoose.connect(process.env.MONGO_URI, {
//     });
//     console.log(`MongoDB Connected: ${conn.connection.host}`);
//   } catch (error) {
//     console.error(`Error: ${error.message}`);
//     process.exit(1); // Exit process with failure
//   }
// };

// module.exports = connectDB;

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    let mongoURI = process.env.MONGO_URI;

    // If URI is not provided, build it from parts
    if (!mongoURI) {
      const user = encodeURIComponent(process.env.MONGO_USER);
      const pass = encodeURIComponent(process.env.MONGO_PASS);
      const host = process.env.MONGO_HOST || 'localhost:27017';
      // const db = process.env.MONGO_DB || 'freshfly_db';
      const authSource = process.env.MONGO_AUTH_DB || db;

      mongoURI = `mongodb://${user}:${pass}@${host}/?authSource=${authSource}`;
    }

    console.log("Connecting to MongoDB...");

    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Mongo Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
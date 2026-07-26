const mongoose = require('mongoose');
const config = require('./env');

// Vercel uchun ulanishni global xotirada keshlaymiz
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  // Agar ulanish allaqachon mavjud bo'lsa, o'shani qaytaramiz (Tezlik > 1ms)
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const mongoURI = config.db.uri;

    if (!mongoURI) {
      throw new Error('MONGO_URI muhit o\'zgaruvchisi (environment variable) topilmadi!');
    }

    const options = {
      bufferCommands: false,         // 🚀 Vercel timeout bo'lmasligi uchun bufferingni o'chiramiz
      maxPoolSize: 10,               // Serverless uchun kichikroq hovuz yetarli
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000, 
      socketTimeoutMS: 45000,       
      family: 4,                    
    };

    cached.promise = mongoose.connect(mongoURI, options).then((mongooseInstance) => {
      console.log(`✅ MongoDB Muvaffaqiyatli ulandi: ${mongooseInstance.connection.host}`);
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null; // Xato bo'lsa keyingi so'rovda qayta urinish uchun tozalaymiz
    console.error(`🔥 MongoDB ulanishda kritik xatolik: ${error.message}`);
    throw error; // Serverless funksiya crash bo'lmasligi uchun process.exit qilmaymiz!
  }

  return cached.conn;
};

module.exports = connectDB;

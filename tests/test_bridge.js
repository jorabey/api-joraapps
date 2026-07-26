require('dotenv').config({ path: '../.env' }); // .env faylingiz yo'lini to'g'ri ko'rsating
const mongoose = require('mongoose');
const App = require('../src/models/App'); // Model yo'llari
const UserAppConnection = require('../src/models/UserAppConnection'); 

const run = async () => {
  try {
    // 1. MongoDB ga ulanish (O'z ulanish stringingizni qo'ying yoki env dan oling)
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27016/jora_apps');
    console.log('MongoDB ga ulandi...');

    // 2. Ilovani qidirish
    const app = await App.findOne({ appToken: "pk_224e574e9f5d6e02354d959721a77ce2" });
    if (!app) {
      console.log('Ilova topilmadi!');
      process.exit(1);
    }

    // 3. Ulanishni yaratish/yangilash
    await UserAppConnection.updateOne(
      { userId: '6a24441f8b1368dbb8996b6d', appId: app._id },
      {
        $set: {
          permissions: { profile: true, email: true, phone: false, gender: false, dob: false },
          scopes: ['read_profile', 'read_email'], // 👈 Kontroller qidirayotgan aniq ruxsatnomalar
          status: "connected",
          lastUsedAt: new Date()
        }
      },
      { upsert: true }
    );

    console.log("Ulanish muvaffaqiyatli yangilandi!");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
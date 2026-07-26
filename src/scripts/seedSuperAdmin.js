/**
 * seedSuperAdmin.js
 * Birinchi super_admin akkauntini yaratish uchun bir martalik skript.
 * Admin yaratish API orqali ochiq emas (faqat mavjud super_admin orqali),
 * shuning uchun platforma ishga tushirilganda birinchi super_admin shu
 * skript orqali to'g'ridan-to'g'ri bazaga yoziladi.
 *
 * Ishlatish:
 *   node src/scripts/seedSuperAdmin.js
 *
 * Muhit o'zgaruvchilari (.env yoki to'g'ridan-to'g'ri):
 *   SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_ADMIN_FULLNAME
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../models/Admin');

const run = async () => {
  const email = "sjorabek42@gmail.com";
  const password = "v123vvvv";
  const fullName = "Sattorov Jo'rabek";

  if (!email || !password) {
    console.error('❌ SEED_ADMIN_EMAIL va SEED_ADMIN_PASSWORD .env faylida bo\'lishi shart.');
    process.exit(1);
  }

  await mongoose.connect("mongodb+srv://sjorabek42:v123vvvv@joranet.xy9cmdd.mongodb.net/?appName=joranet");
  console.log('✅ MongoDB ga ulanildi.');

  const exists = await Admin.findOne({ email: email.toLowerCase().trim() });
  if (exists) {
    console.log(`ℹ️  Admin allaqachon mavjud: ${email}. Hech narsa o'zgartirilmadi.`);
    process.exit(0);
  }

  const admin = await Admin.create({
    fullName,
    email: email.toLowerCase().trim(),
    password,
    role: 'super_admin',
    status: 'active'
  });

  console.log('🎉 Birinchi super_admin yaratildi:');
  console.log(`   Email: ${admin.email}`);
  console.log(`   Role:  ${admin.role}`);
  console.log('   Endi shu email/parol bilan /api/v1/admin/auth/login orqali kiring.');

  process.exit(0);
};

run().catch((err) => {
  console.error('❌ Xatolik:', err.message);
  process.exit(1);
});

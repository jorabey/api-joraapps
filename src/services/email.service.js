const nodemailer = require('nodemailer');
const config = require('../config/env');

// 1. Transporter - bitta ulanishni saqlab qoladi (Connection pooling)
// Bu har safar yangi ulanish ochishdan ko'ra ming barobar tezroq.
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST, // smtp.gmail.com
  port: parseInt(process.env.EMAIL_PORT), // 587
  secure: false, // 587-port uchun FALSE bo'lishi shart!
  family: 4,     // IPv4 ni majburiy ishlatadi (ENETUNREACH xatosini yo'qotadi)
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  // pool va maxConnections o'zgarishsiz qolsa bo'ladi
  pool: true,
  maxConnections: 10,
});

/**
 * Email yuborish xizmati
 * @param {string} to - Qabul qiluvchi
 * @param {string} subject - Mavzu
 * @param {string} html - HTML formatidagi xabar
 */
const sendEmail = async (to, subject, html) => {
  try {
    const mailOptions = {
      from: `"AppStore Support" <${process.env.EMAIL_FROM}>`,
      to,
      subject,
      html,
    };

    // 2. Asynchronous yuborish
    return await transporter.sendMail(mailOptions);
  } catch (error) {
    // 3. Xavfsizlik: Xatolik tafsilotlarini logga yozamiz, foydalanuvchiga emas
    console.error(`❌ Email yuborishda xatolik (${to}):`, error.message);
    throw new Error('Emailni yuborishda muammo yuzaga keldi.');
  }
};

module.exports = { sendEmail };
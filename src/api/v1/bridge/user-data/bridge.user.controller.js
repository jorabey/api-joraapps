const User = require('../../../../models/User'); // Sizning foydalanuvchilar modelingiz
const { AppError } = require('../../../../utils/appErrors');

const getUserProfileForApp = async (req, res, next) => {
  try {
    const { userId } = req.body;
    const permissions = req.userPermissions; // Middleware'dan kelgan ruxsatnomalar

    // 1. Bazadan foydalanuvchini qidiramiz
    const user = await User.findById(userId).lean();
    if (!user) {
      throw new AppError('Foydalanuvchi tizimda topilmadi.', 404);
    }

    // 2. 🔐 GRANULAR PRIVACY FILTER: Faqat ruxsat berilgan maydonlarni yig'amiz
    const safeUserData = {};

    // Profil har doim majburiy (default: true)
    if (permissions.profile) {
      safeUserData.firstName = user.firstName;
      safeUserData.lastName = user.lastName;
      safeUserData.fullName = user.fullName;
      safeUserData.avatar = user.avatar || '';
    }

    // Qolgan maydonlar qat'iy tekshiriladi
    if (permissions.email) safeUserData.email = user.email;
    if (permissions.phone) safeUserData.phone = user.phone;
    if (permissions.gender) safeUserData.gender = user.gender;
    if (permissions.dob) safeUserData.dob = user.dob;

    res.status(200).json({
      status: 'success',
      data: {
        user: safeUserData,
        grantedPermissions: permissions // Ilova qaysi ruxsatlarga ega ekanligini ko'rishi uchun
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getUserProfileForApp };
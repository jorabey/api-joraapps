const { AppError } = require('../utils/appErrors');

// 1. Development rejimida xatoni to'liq yuboramiz (dasturchilar uchun)
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    errorCode: err.errorCode,
    stack: err.stack // Xatolik qayerda yuz berganini aniq ko'rsatadi
  });
};

// 2. Production rejimida faqat "toza" xatolarni yuboramiz (foydalanuvchi va xavfsizlik uchun)
const sendErrorProd = (err, res) => {
  // Operational (biz yaratgan) xatoliklar: Foydalanuvchiga xabarni ko'rsatamiz
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      errorCode: err.errorCode
    });
  } 
  // Programming (kutilmagan) xatoliklar: Tafsilotlarni yashiramiz
  else {
    console.error('🔥 Kutilmagan Xatolik:', err); // Logga yozamiz
    res.status(500).json({
      status: 'error',
      message: 'Nimadir noto\'g\'ri ketdi. Iltimos, keyinroq urinib ko\'ring.',
      errorCode: 'INTERNAL_SERVER_ERROR'
    });
  }
};

// 3. Asosiy Middleware
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // MongoDB'dan kelgan xatolarni bizning formatga o'tkazish
  let error = { ...err };
  error.message = err.message;

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    sendErrorProd(error, res);
  }
};

module.exports = errorHandler;
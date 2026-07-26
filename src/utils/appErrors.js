/**
 * Asosiy dastur xatoliklari klassi.
 * Bu milliardlab so'rovlar uchun optimallashtirilgan.
 */
class AppError extends Error {
  constructor(message, statusCode, errorCode = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode; // Frontend uchun maxsus kod (masalan: AUTH_BLOCKED)
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    
    // Operatsion xatolikmi yoki dasturchi xatoligimi?
    this.isOperational = true;

    // Tezlik uchun: Stack trace faqat kerak bo'lganda ishlaydi
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Maxsus xatolik klasslari (Clean code uchun)
 */
class ValidationError extends AppError {
  constructor(message) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

class AuthError extends AppError {
  constructor(message) {
    super(message, 401, 'AUTH_FAILED');
  }
}

class OtpBlockedError extends AppError {
  constructor(message = 'OTP limitdan oshdi, 24 soat kuting') {
    super(message, 429, 'OTP_BLOCKED');
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthError,
  OtpBlockedError
};
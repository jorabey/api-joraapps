const request = require('supertest');
const app = require('../src/app');

describe('Auth API Testlari', () => {
  it('Yangi dasturchi ro\'yxatdan o\'tishi kerak', async () => {
    const res = await request(app)
      .post('/api/v1/developer/auth/register')
      .send({
        companyName: 'Test Corp',
        email: 'test@example.com',
        password: 'Password123!'
      });
    expect(res.statusCode).toBe(201);
  });
});
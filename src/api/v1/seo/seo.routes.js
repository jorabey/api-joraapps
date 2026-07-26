const express = require('express');
const router = express.Router();
const App = require('../../../models/App'); // Ilovangiz modeli

router.get('/sitemap.xml', async (req, res) => {
  try {
    const DOMAIN = "https://joraapps.vercel.app"; // O'z domeningiz

    // Bazadan barcha ilovalarni tortib olamiz
    const apps = await App.find({ status: "live" }).select('username updatedAt');

    // XML boshlanishi
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // 1. Asosiy sahifalar
    xml += `  <url>\n    <loc>${DOMAIN}/</loc>\n    <changefreq>always</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;

    // 2. Dinamik ilovalar
    apps.forEach((app) => {
      const lastMod = app.updatedAt ? new Date(app.updatedAt).toISOString() : new Date().toISOString();
      xml += `  <url>\n`;
      xml += `    <loc>${DOMAIN}/${app.username}</loc>\n`;
      xml += `    <lastmod>${lastMod}</lastmod>\n`;
      xml += `    <changefreq>daily</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += `  </url>\n`;
    });

    xml += `</urlset>`;

    // Javobni yuborish
    res.header('Content-Type', 'application/xml');
    res.status(200).send(xml);
  } catch (error) {
    console.error("Sitemap xatosi:", error);
    res.status(500).send("Serverda xatolik");
  }
});

module.exports = router;
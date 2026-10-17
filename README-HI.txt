PANDIT DEVANAND SHARMA — READY SECURE ADMIN WORKER
==================================================

यह एक अलग एडमिन/API Worker है। यह आपकी सार्वजनिक वेबसाइट को overwrite नहीं करता।
इस package को सीधे ZIP upload करने से deploy नहीं होगा; files को Private GitHub repo में extract करके डालना होगा।

इस version में:
- admin.html और admin.js उसी Worker से serve होंगे।
- /api/* पर server-side login/session और D1 CRUD API चलेगी।
- आपकी मौजूदा D1 की generic tables को छेड़े बिना secure_astrologers, secure_products, secure_blogs नाम की अलग tables बनेंगी।
- पुरानी सार्वजनिक वेबसाइट का app.js अभी भी localStorage इस्तेमाल करता है। इस admin panel की सामग्री public website पर अपने-आप नहीं दिखेगी; frontend integration अगला अलग काम है।

फाइल संरचना:
- wrangler.toml       Cloudflare Worker + D1 + Assets configuration
- src/index.js        API Worker code
- public/admin.html   Login/dashboard
- public/admin.js     Admin dashboard logic
- schema.sql          D1 में सुरक्षित नई tables
- tools/generate-secrets.html   कंप्यूटर पर local secret बनाएं; इसे public में न रखें

SETUP
-----
1) GitHub पर Private repository https://github.com/devwisdom18/my-jyotish-admin खोलें।
2) Add file > Upload files चुनें। इस package के अंदर की सभी files/folders (src, public, tools, wrangler.toml, package.json, schema.sql, hash-password.mjs, README-HI.txt) upload करें। ZIP फाइल खुद upload न करें।
3) Cloudflare में नया Worker app बनाएं और इस repository को चुनें। Worker name my-jyotish-secure-admin रखें; build command खाली, deploy command npx wrangler deploy, root directory खाली/ repository root रहने दें। Wrangler config का Worker name इसी नाम से मेल खाता है।
4) D1 database my-jyotish-db के Console में schema.sql की सारी SQL पेस्ट करके Execute करें। यह secure_* नाम की नई tables बनाती है और पुरानी tables को नहीं बदलती।
5) Local secrets बनाएं: इस फाइल को browser में खोलें: tools/generate-secrets.html। मजबूत, अनोखा कम-से-कम 14 अक्षरों वाला password बनाकर उसका hash निकालें और अलग random SESSION_SECRET बनाएं। Password/hash/session secret हमें न भेजें और GitHub में न रखें।
6) Cloudflare > Worker my-jyotish-secure-admin > Settings > Variables and secrets में दो Secret entries बनाएं:
   ADMIN_PASSWORD_HASH = local tool से बना पूरा hash
   SESSION_SECRET = local tool से बना random secret
   Save करें। फिर Worker deployment सफल है या नहीं देखिए।
7) Admin page: https://my-jyotish-secure-admin.infodevastrology.workers.dev/admin.html
   (यह URL Worker बनाने के बाद Cloudflare के Visit/domain से verify करें।)
8) पहले login, logout, गलत password, add/delete और mobile view test करें। उसके बाद ही public website integration पर जाएँ।

महत्वपूर्ण सुरक्षा बातें:
- Hash generator वाली tools/generate-secrets.html को public/ में न ले जाएँ और न सार्वजनिक साइट पर serve करें।
- पासवर्ड, verification code, API token, ADMIN_PASSWORD_HASH और SESSION_SECRET चैट में न भेजें।
- इस starter में rate limiting, audit logs, 2FA, password reset और photo upload storage शामिल नहीं हैं।
- यह package admin सामग्री को D1 में साझा करता है, लेकिन पुरानी public वेबसाइट से जोड़ने का integration अभी अलग है।

# 🎯 TargetlyBot

Telegram-first library for organizing, tagging and searching sales targets without turning a Telegram channel into a wall of screenshots.

## الفكرة

القناة تبقى واجهة نظيفة، بينما البوت هو محرك البحث والمكتبة. المالك وحده يضيف المستهدفين، ويمكن السماح لأشخاص محددين بالبحث والتصفح فقط.

## MVP

- 🔎 بحث بالاسم، المدينة، التصنيف، الوسوم والملاحظات
- 🏪 قائمة أحدث المستهدفين
- ➕ إضافة مستهدف للمالك فقط
- 👀 قائمة مستخدمين مسموح لهم بالتصفح
- 💾 SQLite محلي
- 🔐 الأسرار خارج Git عبر `.env`
- 🎯 أساس جاهز لإضافة آليات الاستهداف والتصنيفات والصور لاحقًا

## التشغيل

```bash
npm install
cp .env.example .env
npm start
```

ضع في `.env`:

```env
BOT_TOKEN=your_bot_token
OWNER_ID=your_telegram_user_id
VIEWER_IDS=123456789,987654321
DB_PATH=./data/targetly.db
```

لمعرفة Telegram ID شغّل البوت ثم أرسل `/id`.

## الأوامر

```text
/start
/id
/search اسم المطعم
/add الاسم | المدينة | التصنيف | الرابط | الوسوم | الملاحظات
```

`/add` يعمل للمالك فقط.

## الخطة القادمة

رفع وربط صور كل مستهدف، البحث التفاعلي بالأزرار، صفحات التصنيفات، مكتبة آليات الاستهداف، تفاصيل المستهدف، التعديل والحذف، وربط واجهة قناة Telegram نظيفة بالبوت.

## Security

لا ترفع ملف `.env` ولا Bot Token إلى GitHub. `.env` موجود في `.gitignore`.

## License

MIT

import 'dotenv/config';
import { Bot, InlineKeyboard } from 'grammy';
import { createStore } from './db.js';

const token = process.env.BOT_TOKEN;
if (!token) throw new Error('BOT_TOKEN is required');
const ownerId = Number(process.env.OWNER_ID || 0);
const viewers = new Set((process.env.VIEWER_IDS || '').split(',').map(x => Number(x.trim())).filter(Boolean));
if (ownerId) viewers.add(ownerId);
const store = createStore(process.env.DB_PATH || './data/targetly.db');
const bot = new Bot(token);
const isOwner = ctx => ctx.from?.id === ownerId;
const canView = ctx => viewers.size === 0 || viewers.has(ctx.from?.id);

function menu(owner) {
  const k = new InlineKeyboard().text('🔎 البحث','search').text('🏪 المستهدفون','targets').row().text('🎯 آليات الاستهداف','methods').text('🏷️ التصنيفات','tags');
  if (owner) k.row().text('➕ إضافة مستهدف','add');
  return k;
}

bot.command('start', async ctx => {
  if (!canView(ctx)) return ctx.reply('هذا البوت خاص.');
  const { total } = store.stats();
  await ctx.reply(`🎯 TargetlyBot\n\nمكتبة لتنظيم والبحث عن المستهدفين.\nالمحفوظ حاليًا: ${total}`, { reply_markup: menu(isOwner(ctx)) });
});
bot.command('id', ctx => ctx.reply(`Telegram ID: ${ctx.from.id}`));
bot.command('search', async ctx => {
  if (!canView(ctx)) return;
  const q = ctx.match?.trim();
  if (!q) return ctx.reply('استخدم: /search اسم المطعم');
  const rows = store.search(q);
  if (!rows.length) return ctx.reply('ما لقيت نتائج.');
  await ctx.reply(rows.map(r => `#${r.id} • ${r.name}\n📍 ${r.city || '-'} • ${r.category || '-'}\n🏷️ ${r.tags || '-'}`).join('\n\n'));
});
bot.command('add', async ctx => {
  if (!isOwner(ctx)) return ctx.reply('الإضافة متاحة للمالك فقط.');
  const raw = ctx.match?.trim();
  if (!raw) return ctx.reply('استخدم:\n/add الاسم | المدينة | التصنيف | الرابط | الوسوم | الملاحظات');
  const [name,city='',category='',url='',tags='',notes=''] = raw.split('|').map(x => x.trim());
  if (!name) return ctx.reply('اسم المستهدف مطلوب.');
  const r = store.add({name,city,category,url,tags,notes});
  await ctx.reply(`✅ تم حفظ #${r.id}\n${r.name}\n📍 ${r.city || '-'}\n🏷️ ${r.tags || '-'}`);
});
bot.callbackQuery('targets', async ctx => { await ctx.answerCallbackQuery(); const rows=store.list(); await ctx.reply(rows.length ? rows.map(r=>`#${r.id} • ${r.name} — ${r.city || '-'}`).join('\n') : 'لا يوجد مستهدفون حتى الآن.'); });
bot.callbackQuery('search', async ctx => { await ctx.answerCallbackQuery(); await ctx.reply('🔎 اكتب:\n/search اسم المطعم'); });
bot.callbackQuery('add', async ctx => { await ctx.answerCallbackQuery(); if (isOwner(ctx)) await ctx.reply('➕ أرسل:\n/add الاسم | المدينة | التصنيف | الرابط | الوسوم | الملاحظات'); });
bot.callbackQuery('methods', async ctx => { await ctx.answerCallbackQuery(); await ctx.reply('🎯 آليات الاستهداف\nقريبًا: مكتبة قواعد وأساليب الاستهداف.'); });
bot.callbackQuery('tags', async ctx => { await ctx.answerCallbackQuery(); await ctx.reply('🏷️ التصنيفات\nقريبًا: تصفح المستهدفين حسب الوسوم.'); });
bot.catch(err => console.error('Bot error:', err.error));
bot.start({ onStart: info => console.log(`@${info.username} is running`) });

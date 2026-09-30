const API = 'https://api.telegram.org/bot';

async function telegram(env, method, body) {
  return fetch(`${API}${env.BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

const buttons = owner => ({ inline_keyboard: [
  [{text:'🔎 البحث',callback_data:'search'},{text:'🏪 المستهدفون',callback_data:'targets'}],
  [{text:'🎯 آليات الاستهداف',callback_data:'methods'},{text:'🏷️ التصنيفات',callback_data:'tags'}],
  ...(owner ? [[{text:'➕ إضافة مستهدف',callback_data:'add'}]] : [])
]});

function allowed(env, id) {
  const ids = String(env.VIEWER_IDS || '').split(',').map(x=>x.trim()).filter(Boolean);
  return !ids.length || String(id) === String(env.OWNER_ID) || ids.includes(String(id));
}

async function send(env, chatId, text, reply_markup) {
  return telegram(env, 'sendMessage', { chat_id: chatId, text, reply_markup });
}

async function handleMessage(message, env) {
  const chatId = message.chat.id;
  const userId = message.from?.id;
  const text = message.text || '';
  if (text === '/id') return send(env, chatId, `Telegram ID: ${userId}`);
  if (!allowed(env, userId)) return send(env, chatId, 'هذا البوت خاص.');

  if (text === '/start') {
    const row = await env.DB.prepare('SELECT COUNT(*) AS total FROM targets').first();
    return send(env, chatId, `🎯 TargetlyBot\n\nمكتبة لتنظيم والبحث عن المستهدفين.\nالمحفوظ حاليًا: ${row?.total || 0}`, buttons(String(userId)===String(env.OWNER_ID)));
  }
  if (text.startsWith('/search ')) {
    const q = `%${text.slice(8).trim()}%`;
    const { results=[] } = await env.DB.prepare('SELECT * FROM targets WHERE name LIKE ? OR city LIKE ? OR category LIKE ? OR tags LIKE ? OR notes LIKE ? ORDER BY updated_at DESC LIMIT 20').bind(q,q,q,q,q).all();
    return send(env, chatId, results.length ? results.map(r=>`#${r.id} • ${r.name}\n📍 ${r.city || '-'} • ${r.category || '-'}\n🏷️ ${r.tags || '-'}`).join('\n\n') : 'ما لقيت نتائج.');
  }
  if (text.startsWith('/add ')) {
    if (String(userId)!==String(env.OWNER_ID)) return send(env,chatId,'الإضافة متاحة للمالك فقط.');
    const [name,city='',category='',url='',tags='',notes=''] = text.slice(5).split('|').map(x=>x.trim());
    if (!name) return send(env,chatId,'اسم المستهدف مطلوب.');
    const result = await env.DB.prepare('INSERT INTO targets (name,city,category,url,tags,notes,status) VALUES (?,?,?,?,?,?,?) RETURNING id').bind(name,city,category,url,tags,notes,'new').first();
    return send(env,chatId,`✅ تم حفظ #${result.id}\n${name}\n📍 ${city || '-'}\n🏷️ ${tags || '-'}`);
  }
  return send(env,chatId,'استخدم /start لفتح المكتبة.');
}

async function handleCallback(q, env) {
  await telegram(env,'answerCallbackQuery',{callback_query_id:q.id});
  const chatId=q.message.chat.id, userId=q.from.id;
  if (!allowed(env,userId)) return;
  if(q.data==='search') return send(env,chatId,'🔎 اكتب:\n/search اسم المطعم');
  if(q.data==='add') return String(userId)===String(env.OWNER_ID) ? send(env,chatId,'➕ أرسل:\n/add الاسم | المدينة | التصنيف | الرابط | الوسوم | الملاحظات') : null;
  if(q.data==='methods') return send(env,chatId,'🎯 آليات الاستهداف\nقريبًا: مكتبة قواعد وأساليب الاستهداف.');
  if(q.data==='tags') return send(env,chatId,'🏷️ التصنيفات\nقريبًا: تصفح المستهدفين حسب الوسوم.');
  if(q.data==='targets') {
    const {results=[]}=await env.DB.prepare('SELECT * FROM targets ORDER BY id DESC LIMIT 20').all();
    return send(env,chatId,results.length?results.map(r=>`#${r.id} • ${r.name} — ${r.city || '-'}`).join('\n'):'لا يوجد مستهدفون حتى الآن.');
  }
}

export default {
  async fetch(request, env) {
    const url=new URL(request.url);
    if(request.method==='GET' && url.pathname==='/') return new Response('TargetlyBot is running on Cloudflare Workers.');
    if(request.method!=='POST' || url.pathname!=='/telegram') return new Response('Not found',{status:404});
    if(env.WEBHOOK_SECRET && request.headers.get('X-Telegram-Bot-Api-Secret-Token')!==env.WEBHOOK_SECRET) return new Response('Unauthorized',{status:401});
    const update=await request.json();
    if(update.message) await handleMessage(update.message,env);
    if(update.callback_query) await handleCallback(update.callback_query,env);
    return new Response('ok');
  }
};

const API = 'https://api.telegram.org/bot';

async function telegram(env, method, body) {
  return fetch(`${API}${env.BOT_TOKEN}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  });
}

const sessions = new Map();
const fields = [
  ['name','🏪 اكتب اسم المطعم أو الكافيه:'],
  ['city','📍 اكتب المدينة:'],
  ['category','🍽️ اكتب التصنيف (مطعم، كافيه، حلويات...):'],
  ['url','🔗 أرسل رابط الحساب أو الموقع:'],
  ['tags','🏷️ اكتب الوسوم مفصولة بفاصلة، مثال:\nLinktree, متعدد الفروع, منيو PDF'],
  ['notes','📝 اكتب ملاحظاتك عن المستهدف:']
];

const mainButtons = owner => ({ inline_keyboard: [
  [{text:'🔎 البحث',callback_data:'search'},{text:'🏪 المستهدفون',callback_data:'targets'}],
  [{text:'🎯 آليات الاستهداف',callback_data:'methods'},{text:'🏷️ التصنيفات',callback_data:'tags'}],
  ...(owner ? [[{text:'➕ إضافة مستهدف',callback_data:'add'}]] : [])
]});
const stepButtons = { inline_keyboard: [[{text:'⏭️ تخطي',callback_data:'add_skip'},{text:'❌ إلغاء',callback_data:'add_cancel'}]] };
const confirmButtons = { inline_keyboard: [[{text:'✅ حفظ المستهدف',callback_data:'add_save'}],[{text:'↩️ إلغاء',callback_data:'add_cancel'}]] };

function allowed(env,id){const ids=String(env.VIEWER_IDS||'').split(',').map(x=>x.trim()).filter(Boolean);return !ids.length||String(id)===String(env.OWNER_ID)||ids.includes(String(id));}
async function send(env,chatId,text,reply_markup){return telegram(env,'sendMessage',{chat_id:chatId,text,reply_markup});}
function owner(env,id){return String(id)===String(env.OWNER_ID);}
function sessionKey(userId){return String(userId);}
async function askStep(env,chatId,s){const [,prompt]=fields[s.step];return send(env,chatId,`${prompt}\n\nالخطوة ${s.step+1} من ${fields.length}`,s.step===0?{inline_keyboard:[[{text:'❌ إلغاء',callback_data:'add_cancel'}]]}:stepButtons);}
function preview(d){return `📋 مراجعة المستهدف\n\n🏪 ${d.name||'-'}\n📍 ${d.city||'-'}\n🍽️ ${d.category||'-'}\n🔗 ${d.url||'-'}\n🏷️ ${d.tags||'-'}\n📝 ${d.notes||'-'}`;}
async function startAdd(env,chatId,userId){const s={step:0,data:{}};sessions.set(sessionKey(userId),s);return askStep(env,chatId,s);}
async function finishStep(env,chatId,userId,value){const s=sessions.get(sessionKey(userId));if(!s)return false;const [key]=fields[s.step];s.data[key]=value;s.step++;if(s.step>=fields.length){await send(env,chatId,preview(s.data),confirmButtons);}else await askStep(env,chatId,s);return true;}

async function handleMessage(message,env){
  const chatId=message.chat.id,userId=message.from?.id,text=(message.text||'').trim();
  if(text==='/id')return send(env,chatId,`Telegram ID: ${userId}`);
  if(!allowed(env,userId))return send(env,chatId,'هذا البوت خاص.');
  const active=sessions.get(sessionKey(userId));
  if(active&&owner(env,userId)&&text&&!text.startsWith('/'))return finishStep(env,chatId,userId,text);
  if(text==='/start'){const row=await env.DB.prepare('SELECT COUNT(*) AS total FROM targets').first();return send(env,chatId,`🎯 TargetlyBot\n\nمكتبة لتنظيم والبحث عن المستهدفين.\nالمحفوظ حاليًا: ${row?.total||0}`,mainButtons(owner(env,userId)));}
  if(text==='/add'&&owner(env,userId))return startAdd(env,chatId,userId);
  if(text.startsWith('/search ')){const q=`%${text.slice(8).trim()}%`;const {results=[]}=await env.DB.prepare('SELECT * FROM targets WHERE name LIKE ? OR city LIKE ? OR category LIKE ? OR tags LIKE ? OR notes LIKE ? ORDER BY updated_at DESC LIMIT 20').bind(q,q,q,q,q).all();return send(env,chatId,results.length?results.map(r=>`#${r.id} • ${r.name}\n📍 ${r.city||'-'} • ${r.category||'-'}\n🏷️ ${r.tags||'-'}`).join('\n\n'):'ما لقيت نتائج.');}
  return send(env,chatId,'استخدم /start لفتح المكتبة.');
}

async function handleCallback(q,env){
  await telegram(env,'answerCallbackQuery',{callback_query_id:q.id});
  const chatId=q.message.chat.id,userId=q.from.id,key=sessionKey(userId);
  if(!allowed(env,userId))return;
  if(q.data==='add'&&owner(env,userId))return startAdd(env,chatId,userId);
  if(q.data==='add_cancel'){sessions.delete(key);return send(env,chatId,'❌ تم إلغاء الإضافة.',mainButtons(owner(env,userId)));}
  if(q.data==='add_skip'&&owner(env,userId))return finishStep(env,chatId,userId,'');
  if(q.data==='add_save'&&owner(env,userId)){
    const s=sessions.get(key);if(!s)return send(env,chatId,'انتهت جلسة الإضافة. اضغط ➕ إضافة مستهدف من جديد.');
    const d=s.data;if(!d.name)return send(env,chatId,'اسم المستهدف مطلوب.');
    const result=await env.DB.prepare('INSERT INTO targets (name,city,category,url,tags,notes,status) VALUES (?,?,?,?,?,?,?) RETURNING id').bind(d.name,d.city||'',d.category||'',d.url||'',d.tags||'',d.notes||'','new').first();
    sessions.delete(key);return send(env,chatId,`✅ تم حفظ المستهدف #${result.id}\n\n🏪 ${d.name}\n📍 ${d.city||'-'}`,mainButtons(true));
  }
  if(q.data==='search')return send(env,chatId,'🔎 اكتب:\n/search اسم المطعم');
  if(q.data==='methods')return send(env,chatId,'🎯 آليات الاستهداف\nقريبًا: مكتبة قواعد وأساليب الاستهداف.');
  if(q.data==='tags')return send(env,chatId,'🏷️ التصنيفات\nقريبًا: تصفح المستهدفين حسب الوسوم.');
  if(q.data==='targets'){const {results=[]}=await env.DB.prepare('SELECT * FROM targets ORDER BY id DESC LIMIT 20').all();return send(env,chatId,results.length?results.map(r=>`#${r.id} • ${r.name} — ${r.city||'-'}`).join('\n'):'لا يوجد مستهدفون حتى الآن.');}
}

export default {async fetch(request,env){
  const url=new URL(request.url);
  if(request.method==='GET'&&url.pathname==='/')return new Response('TargetlyBot is running on Cloudflare Workers.');
  if(request.method==='GET'&&url.pathname==='/setup-webhook'){
    if(!env.BOT_TOKEN||!env.WEBHOOK_SECRET)return new Response('Missing BOT_TOKEN or WEBHOOK_SECRET in Cloudflare.',{status:500});
    const response=await telegram(env,'setWebhook',{url:`${url.origin}/telegram`,secret_token:env.WEBHOOK_SECRET,allowed_updates:['message','callback_query'],drop_pending_updates:true});
    const data=await response.json();if(!data.ok)return Response.json({ok:false,description:data.description||'Telegram rejected webhook setup.'},{status:502});
    return new Response('✅ Telegram webhook connected. You can now open the bot and send /start.');
  }
  if(request.method!=='POST'||url.pathname!=='/telegram')return new Response('Not found',{status:404});
  if(env.WEBHOOK_SECRET&&request.headers.get('X-Telegram-Bot-Api-Secret-Token')!==env.WEBHOOK_SECRET)return new Response('Unauthorized',{status:401});
  const update=await request.json();if(update.message)await handleMessage(update.message,env);if(update.callback_query)await handleCallback(update.callback_query,env);return new Response('ok');
}};

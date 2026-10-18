/** LOCAL-ONLY development AI endpoint. Never deploy without authentication, rate limits and abuse controls. */
import http from 'node:http';
import { surfaceSystemPrompt } from '../../src/index.js';
import { parseSurfaceText } from '../../src/transport.js';

const PORT=8787;
const MAX_BODY=4096;
const handler=async (req,res)=>{
  const reply=(status,body)=>{
    res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});
    res.end(JSON.stringify(body));
  };
  if (req.url!=='/api/generate'||req.method!=='POST')return reply(404,{error:'Not found'});
  if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL)return reply(503,{error:'Set OPENAI_API_KEY and OPENAI_MODEL on the local server first.'});
  try {
    let buffer='';
    for await (const part of req){buffer+=part.toString('utf8');if(Buffer.byteLength(buffer)>MAX_BODY)return reply(413,{error:'Request too large'});}
    const prompt=JSON.parse(buffer).prompt;
    if(typeof prompt!=='string'||!prompt.trim()||prompt.length>1000)return reply(400,{error:'Prompt must have 1–1000 characters'});
    const upstream=await fetch('https://api.openai.com/v1/chat/completions',{
      method:'POST',headers:{'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({model:process.env.OPENAI_MODEL,messages:[
        {role:'system',content:surfaceSystemPrompt()},
        {role:'user',content:prompt}
      ],response_format:{type:'json_object'}}),signal:AbortSignal.timeout(45000)
    });
    if(!upstream.ok)return reply(502,{error:`Model request failed (${upstream.status}); check configured model and credentials`});
    const result=await upstream.json();
    const output=result?.choices?.[0]?.message?.content;
    const document=parseSurfaceText(output);
    return reply(200,document);
  }catch(error){
    console.error('Local generator error:',error instanceof Error?error.message:'unknown');
    return reply(400,{error:'Model did not return a valid Surface document. Try a shorter or simpler prompt.'});
  }
};
http.createServer(handler).listen(PORT,'127.0.0.1',()=>console.log(`Local Surface generator listening on http://127.0.0.1:${PORT}`));
